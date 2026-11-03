import {db} from '../db/db'
import {getSettings} from '../db/settings'
import type {Feed} from '../db/types'
import {canonicalFeedUrl} from '../shared/model/feed-url'
import {generateOpml, parseOpmlFeeds} from '../shared/parser/parse-opml'
import {parseFeedDocument} from '../shared/parser/parse-feed'
import {syncActionBadge} from './badge'
import {getActiveDiscovery, getDiscoveryForTab} from './discovery'
import {fetchFeed} from './fetcher'
import {ingestFeed} from './ingest'
import {notifyNewPosts} from './notifications'
import {fetchFeedInTab, findSameOriginTab} from './page-fetch'
import {backoffSeconds, BATCH_SIZE, effectiveInterval, selectDueFeeds, WORK_BUDGET_MS} from './scheduler'

export type Command =
    | {
    type: 'feed:add'
    url: string
    folderId?: string | null
    refreshInterval?: number | null
    sourceTabId?: number
}
    | {
    type: 'feed:update'
    id: string
    patch: {
        title?: string
        folderId?: string | null
        refreshInterval?: number | null
    }
}
    | { type: 'feed:delete'; id: string }
    | { type: 'feed:refresh'; id: string }
    | { type: 'feed:refresh-all' }
    | { type: 'folder:add'; name: string }
    | { type: 'folder:update'; id: string; patch: { name?: string; sortOrder?: number } }
    | { type: 'folder:delete'; id: string }
    | { type: 'opml:import'; xml: string }
    | { type: 'opml:export' }
    | { type: 'data:clear' }
    | { type: 'worker:reschedule' }
    | { type: 'action:refresh' }
    | { type: 'discovery:active' }
    | { type: 'discovery:detect'; tabId?: number }

export type CommandResult =
    | { ok: true; data?: unknown }
    | { ok: false; error: string }

const OPML_STAGGER_MS = 30_000

export function normalizeFeedUrl(raw: string): string {
    const value = raw.trim()
    if (!value) throw new Error('Enter a valid http(s) feed URL')

    let url: URL
    try {
        url = new URL(value)
    } catch {
        throw new Error('Enter a valid http(s) feed URL')
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Enter a valid http(s) feed URL')
    }

    url.hash = ''
    return url.toString()
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

function faviconFor(
    imageUrl: string | null,
    siteUrl: string | null,
    feedUrl: string
): string | null {
    if (imageUrl) return imageUrl

    try {
        return new URL('/favicon.ico', siteUrl ?? feedUrl).toString()
    } catch {
        return null
    }
}

async function recordFailure(
    feed: Feed,
    message: string,
    interval: number,
    now: number
): Promise<void> {
    const errorCount = feed.errorCount + 1
    const delay = backoffSeconds(interval, errorCount)

    await db.feeds.update(feed.id, {
        errorCount,
        lastError: message,
        nextFetchAt: now + delay * 1_000,
        updatedAt: now
    })
}

type FeedDocumentResult =
    | {
    status: 'ok'
    text: string
    finalUrl: string
    etag: string | null
    lastModified: string | null
    mode: 'background' | 'page'
}
    | {
    status: 'not-modified'
    finalUrl: string
    etag: string | null
    lastModified: string | null
}
    | { status: 'error'; error: string; noTab?: boolean }

async function fetchFeedDocument(
    url: string,
    mode: 'background' | 'page',
    etag: string | null,
    lastModified: string | null,
    preferredTabId?: number
): Promise<FeedDocumentResult> {
    if (mode === 'page') {
        const tabId = await findSameOriginTab(url, preferredTabId)
        if (tabId === null) {
            return {
                status: 'error',
                error: 'Open a tab on this site to refresh',
                noTab: true
            }
        }

        const page = await fetchFeedInTab(tabId, url)
        if (page.status === 'error') return page

        return {
            status: 'ok',
            text: page.text,
            finalUrl: page.finalUrl,
            etag: null,
            lastModified: null,
            mode: 'page'
        }
    }

    const fetched = await fetchFeed({url, etag, lastModified})
    if (fetched.status !== 'error') {
        return fetched.status === 'ok' ? {...fetched, mode: 'background'} : fetched
    }

    const tabId = await findSameOriginTab(url, preferredTabId)
    if (tabId === null) return fetched

    const page = await fetchFeedInTab(tabId, url)
    if (page.status === 'error') return page

    return {
        status: 'ok',
        text: page.text,
        finalUrl: page.finalUrl,
        etag: null,
        lastModified: null,
        mode: 'page'
    }
}

export async function refreshFeed(
    feedId: string,
    now = Date.now()
): Promise<{ inserted: number; error?: string }> {
    const feed = await db.feeds.get(feedId)
    if (!feed) return {inserted: 0, error: 'Feed not found'}

    const settings = await getSettings()
    const interval = effectiveInterval(feed, settings.refreshInterval)
    const fetched = await fetchFeedDocument(
        feed.url,
        feed.fetchMode ?? 'background',
        feed.etag,
        feed.lastModified
    )

    if (fetched.status === 'error') {
        if (fetched.noTab) {
            await db.feeds.update(feed.id, {
                lastError: fetched.error,
                nextFetchAt: now + interval * 1_000,
                updatedAt: now
            })
            return {inserted: 0, error: fetched.error}
        }

        await recordFailure(feed, fetched.error, interval, now)
        return {inserted: 0, error: fetched.error}
    }

    if (fetched.status === 'not-modified') {
        await db.feeds.update(feed.id, {
            etag: fetched.etag,
            lastModified: fetched.lastModified,
            lastFetchedAt: now,
            nextFetchAt: now + interval * 1_000,
            errorCount: 0,
            lastError: null,
            updatedAt: now
        })
        await syncActionBadge()
        return {inserted: 0}
    }

    let parsed
    try {
        parsed = parseFeedDocument(fetched.text)
    } catch (error) {
        const message = errorMessage(error)
        await recordFailure(feed, message, interval, now)
        return {inserted: 0, error: message}
    }

    const firstFetch = feed.lastFetchedAt === null
    const result = await ingestFeed(feed, parsed, {
        retention: settings.retentionPerFeed,
        firstFetch,
        now
    })
    const finalUrl = normalizeFeedUrl(fetched.finalUrl)
    const urlTaken =
        finalUrl !== feed.url &&
        Boolean(await db.feeds.where('url').equals(finalUrl).first())

    await db.feeds.update(feed.id, {
        url: urlTaken ? feed.url : finalUrl,
        siteUrl: parsed.siteUrl ?? feed.siteUrl,
        description: parsed.description ?? feed.description,
        favicon: faviconFor(parsed.imageUrl, parsed.siteUrl, finalUrl),
        lastFetchedAt: now,
        nextFetchAt: now + interval * 1_000,
        etag: fetched.etag,
        lastModified: fetched.lastModified,
        fetchMode: fetched.mode,
        errorCount: 0,
        lastError: null,
        updatedAt: now
    })

    if (settings.notifications && !firstFetch && result.inserted > 0) {
        await notifyNewPosts(feed.title, result.inserted)
    }

    await syncActionBadge()
    return {inserted: result.inserted}
}

export async function runDueFeeds(
    now: number
): Promise<{ processed: number; remaining: boolean }> {
    const startedAt = Date.now()
    let processed = 0

    while (Date.now() - startedAt <= WORK_BUDGET_MS) {
        const feeds = await db.feeds.toArray()
        const due = selectDueFeeds(feeds, now, BATCH_SIZE)
        if (!due.length) break

        await Promise.all(due.map((feed) => refreshFeed(feed.id, now)))
        processed += due.length
    }

    const remaining = (await db.feeds.where('nextFetchAt').belowOrEqual(now).count()) > 0
    return {processed, remaining}
}

async function addFeed(command: Extract<Command, { type: 'feed:add' }>): Promise<CommandResult> {
    const url = normalizeFeedUrl(command.url)
    const existingFeeds = await db.feeds.toArray()
    const canonicalUrl = canonicalFeedUrl(url)
    if (existingFeeds.some((feed) => canonicalFeedUrl(feed.url) === canonicalUrl)) {
        throw new Error('Feed already exists')
    }
    if (command.folderId) {
        if (!(await db.folders.get(command.folderId))) throw new Error('Folder not found')
    }

    const settings = await getSettings()
    const fetched = await fetchFeedDocument(
        url,
        'background',
        null,
        null,
        command.sourceTabId
    )
    if (fetched.status === 'error') throw new Error(fetched.error)
    if (fetched.status === 'not-modified') throw new Error('Feed returned no content')

    const parsed = parseFeedDocument(fetched.text)
    const now = Date.now()
    const finalUrl = normalizeFeedUrl(fetched.finalUrl)
    if (
        existingFeeds.some(
            (feed) => canonicalFeedUrl(feed.url) === canonicalFeedUrl(finalUrl)
        )
    ) {
        throw new Error('Feed already exists')
    }

    const feed: Feed = {
        id: crypto.randomUUID(),
        url: finalUrl,
        siteUrl: parsed.siteUrl,
        title: parsed.title,
        description: parsed.description,
        favicon: faviconFor(parsed.imageUrl, parsed.siteUrl, finalUrl),
        folderId: command.folderId ?? null,
        refreshInterval: command.refreshInterval ?? null,
        lastFetchedAt: now,
        nextFetchAt: 0,
        etag: fetched.etag,
        lastModified: fetched.lastModified,
        fetchMode: fetched.mode,
        errorCount: 0,
        lastError: null,
        unreadCount: 0,
        createdAt: now,
        updatedAt: now
    }
    feed.nextFetchAt = now + effectiveInterval(feed, settings.refreshInterval) * 1_000

    await db.feeds.add(feed)
    const result = await ingestFeed(feed, parsed, {
        retention: settings.retentionPerFeed,
        firstFetch: true,
        now
    })
    await syncActionBadge()

    return {ok: true, data: {feedId: feed.id, inserted: result.inserted}}
}

async function importOpml(xml: string): Promise<CommandResult> {
    const entries = parseOpmlFeeds(xml)
    const now = Date.now()
    const feeds = await db.feeds.toArray()
    const folders = await db.folders.toArray()
    const urls = new Set(feeds.map((feed) => feed.url))
    const foldersByName = new Map(folders.map((folder) => [folder.name, folder]))
    let createdFolders = 0
    let createdFeeds = 0

    for (const entry of entries) {
        let url: string
        try {
            url = normalizeFeedUrl(entry.url)
        } catch {
            continue
        }
        if (urls.has(url)) continue
        urls.add(url)

        let folderId: string | null = null
        if (entry.folderPath.length) {
            const name = entry.folderPath.join(' / ')
            let folder = foldersByName.get(name)

            if (!folder) {
                folder = {
                    id: crypto.randomUUID(),
                    name,
                    sortOrder: foldersByName.size,
                    createdAt: now,
                    updatedAt: now
                }
                foldersByName.set(name, folder)
                await db.folders.add(folder)
                createdFolders += 1
            }
            folderId = folder.id
        }

        await db.feeds.add({
            id: crypto.randomUUID(),
            url,
            siteUrl: null,
            title: entry.title,
            description: null,
            favicon: null,
            folderId,
            refreshInterval: null,
            lastFetchedAt: null,
            nextFetchAt: now + 1_000 + createdFeeds * OPML_STAGGER_MS,
            etag: null,
            lastModified: null,
            errorCount: 0,
            lastError: null,
            unreadCount: 0,
            createdAt: now,
            updatedAt: now
        })
        createdFeeds += 1
    }

    await syncActionBadge()
    return {ok: true, data: {folders: createdFolders, feeds: createdFeeds}}
}

export async function handleCommand(command: Command): Promise<CommandResult> {
    try {
        switch (command.type) {
            case 'feed:add':
                return await addFeed(command)

            case 'feed:update': {
                const feed = await db.feeds.get(command.id)
                if (!feed) throw new Error('Feed not found')
                if (command.patch.folderId) {
                    if (!(await db.folders.get(command.patch.folderId))) {
                        throw new Error('Folder not found')
                    }
                }

                const now = Date.now()
                const updates: Partial<Feed> = {updatedAt: now}
                let intervalChanged = false

                if (command.patch.title !== undefined) {
                    const title = command.patch.title.trim()
                    if (!title) throw new Error('Feed title is required')
                    updates.title = title
                }
                if (command.patch.folderId !== undefined) {
                    updates.folderId = command.patch.folderId
                }
                if (command.patch.refreshInterval !== undefined) {
                    updates.refreshInterval = command.patch.refreshInterval
                    intervalChanged = true
                }

                if (intervalChanged) {
                    const settings = await getSettings()
                    updates.nextFetchAt =
                        now +
                        effectiveInterval(feed, settings.refreshInterval) * 1_000
                }

                await db.feeds.update(feed.id, updates)
                return {ok: true}
            }

            case 'feed:delete': {
                const feed = await db.feeds.get(command.id)
                if (!feed) throw new Error('Feed not found')

                await db.transaction('rw', db.feeds, db.posts, async () => {
                    await db.posts.where('feedId').equals(feed.id).delete()
                    await db.feeds.delete(feed.id)
                })
                await syncActionBadge()
                return {ok: true}
            }

            case 'feed:refresh': {
                const result = await refreshFeed(command.id)
                if (result.error) throw new Error(result.error)
                return {ok: true, data: result}
            }

            case 'feed:refresh-all': {
                const now = Date.now()
                await db.feeds.toCollection().modify({nextFetchAt: now, updatedAt: now})
                const result = await runDueFeeds(now)
                return {ok: true, data: result}
            }

            case 'folder:add': {
                const name = command.name.trim()
                if (!name) throw new Error('Folder name is required')

                const folders = await db.folders.toArray()
                const now = Date.now()
                await db.folders.add({
                    id: crypto.randomUUID(),
                    name,
                    sortOrder: folders.reduce((max, folder) => Math.max(max, folder.sortOrder + 1), 0),
                    createdAt: now,
                    updatedAt: now
                })
                return {ok: true}
            }

            case 'folder:update': {
                const folder = await db.folders.get(command.id)
                if (!folder) throw new Error('Folder not found')

                const updates: { name?: string; sortOrder?: number; updatedAt: number } = {
                    updatedAt: Date.now()
                }
                if (command.patch.name !== undefined) {
                    const name = command.patch.name.trim()
                    if (!name) throw new Error('Folder name is required')
                    updates.name = name
                }
                if (command.patch.sortOrder !== undefined) {
                    updates.sortOrder = command.patch.sortOrder
                }

                await db.folders.update(folder.id, updates)
                return {ok: true}
            }

            case 'folder:delete': {
                const folder = await db.folders.get(command.id)
                if (!folder) throw new Error('Folder not found')

                await db.transaction('rw', db.feeds, db.folders, async () => {
                    await db.feeds
                        .where('folderId')
                        .equals(folder.id)
                        .modify({folderId: null, updatedAt: Date.now()})
                    await db.folders.delete(folder.id)
                })
                await syncActionBadge()
                return {ok: true}
            }

            case 'worker:reschedule': {
                const [feeds, settings] = await Promise.all([
                    db.feeds.toArray(),
                    getSettings()
                ])
                const now = Date.now()

                await db.feeds.bulkPut(
                    feeds.map((feed) => ({
                        ...feed,
                        nextFetchAt:
                            now + effectiveInterval(feed, settings.refreshInterval) * 1_000,
                        updatedAt: now
                    }))
                )
                return {ok: true}
            }

            case 'action:refresh':
                await syncActionBadge()
                return {ok: true}

            case 'discovery:active':
                return {ok: true, data: await getActiveDiscovery()}

            case 'discovery:detect': {
                if (command.tabId === undefined) {
                    return {ok: true, data: await getActiveDiscovery({force: true})}
                }
                return {
                    ok: true,
                    data: await getDiscoveryForTab(command.tabId, {force: true})
                }
            }

            case 'opml:import':
                return await importOpml(command.xml)

            case 'opml:export': {
                const [feeds, folders] = await Promise.all([
                    db.feeds.toArray(),
                    db.folders.toArray()
                ])
                return {ok: true, data: generateOpml(folders, feeds)}
            }

            case 'data:clear': {
                await db.transaction(
                    'rw',
                    db.feeds,
                    db.folders,
                    db.posts,
                    db.settings,
                    async () => {
                        await Promise.all([
                            db.feeds.clear(),
                            db.folders.clear(),
                            db.posts.clear(),
                            db.settings.clear()
                        ])
                    }
                )
                await syncActionBadge()
                return {ok: true}
            }

            default:
                throw new Error('Unknown command')
        }
    } catch (error) {
        return {ok: false, error: errorMessage(error)}
    }
}
