import {db} from '../db/db'
import {canonicalFeedUrl} from '../shared/model/feed-url'
import {discoverPageFeeds, type DiscoveredFeed} from './discovery-page'

const CACHE_TTL_MS = 10 * 60_000

interface CachedDiscovery {
    url: string
    feeds: DiscoveredFeed[]
    expiresAt: number
}

interface DetectResult {
    tabId: number
    pageUrl: string | null
    feeds: DiscoveredFeed[]
}

export interface DiscoveryFeed extends DiscoveredFeed {
    subscribed: boolean
}

export interface DiscoveryResult {
    tabId: number | null
    pageUrl: string | null
    feeds: DiscoveryFeed[]
}

const cache = new Map<number, CachedDiscovery>()
const inflight = new Map<number, Promise<DetectResult>>()
const generations = new Map<number, number>()

function isHttpUrl(url: string | undefined): url is string {
    return Boolean(url && /^https?:\/\//i.test(url))
}

async function withSubscribed(feeds: DiscoveredFeed[]): Promise<DiscoveryFeed[]> {
    const stored = await db.feeds.toArray()
    const urls = new Set(
        stored.flatMap((feed) => [
            canonicalFeedUrl(feed.url),
            ...(feed.sourceUrl ? [canonicalFeedUrl(feed.sourceUrl)] : [])
        ])
    )
    return feeds.map((feed) => ({
        ...feed,
        subscribed: urls.has(canonicalFeedUrl(feed.url))
    }))
}

async function runDetect(tabId: number, generation: number): Promise<DetectResult> {
    let tab: chrome.tabs.Tab | null = null
    try {
        tab = await chrome.tabs.get(tabId)
    } catch {
        cache.delete(tabId)
        return {tabId, pageUrl: null, feeds: []}
    }

    if (!tab || !isHttpUrl(tab.url)) {
        cache.delete(tabId)
        return {tabId, pageUrl: null, feeds: []}
    }

    const pageUrl = tab.url
    let feeds: DiscoveredFeed[] = []
    try {
        const results = await chrome.scripting.executeScript({
            target: {tabId},
            func: discoverPageFeeds
        })
        const result = results[0]?.result
        if (Array.isArray(result)) feeds = result
    } catch {
        // Restricted pages and injection failures simply have no feeds.
    }

    let latest: chrome.tabs.Tab | null = null
    try {
        latest = await chrome.tabs.get(tabId)
    } catch {
        // The tab closed during detection.
    }

    if (
        !latest ||
        latest.url !== pageUrl ||
        (generations.get(tabId) ?? 0) !== generation
    ) {
        cache.delete(tabId)
        return {tabId, pageUrl: latest?.url ?? null, feeds: []}
    }

    cache.set(tabId, {
        url: pageUrl,
        feeds,
        expiresAt: Date.now() + CACHE_TTL_MS
    })
    return {tabId, pageUrl, feeds}
}

export async function detectTab(
    tabId: number,
    options: {force?: boolean} = {}
): Promise<DetectResult> {
    const cached = cache.get(tabId)
    if (!options.force && cached && cached.expiresAt > Date.now()) {
        return {tabId, pageUrl: cached.url, feeds: cached.feeds}
    }

    const running = inflight.get(tabId)
    if (running) return running

    const generation = generations.get(tabId) ?? 0
    const task = runDetect(tabId, generation).finally(() => {
        if (inflight.get(tabId) === task) inflight.delete(tabId)
    })
    inflight.set(tabId, task)
    return task
}

export async function getDiscoveryForTab(
    tabId: number,
    options: {force?: boolean} = {}
): Promise<DiscoveryResult> {
    const result = await detectTab(tabId, options)
    return {
        tabId: result.tabId,
        pageUrl: result.pageUrl,
        feeds: await withSubscribed(result.feeds)
    }
}

export async function getActiveDiscovery(
    options: {force?: boolean} = {}
): Promise<DiscoveryResult> {
    const tabs = await chrome.tabs.query({active: true, lastFocusedWindow: true})
    const tab = tabs[0]
    if (!tab || typeof tab.id !== 'number') {
        return {tabId: null, pageUrl: null, feeds: []}
    }

    return getDiscoveryForTab(tab.id, options)
}

export function clearDiscovery(tabId: number): void {
    cache.delete(tabId)
    inflight.delete(tabId)
    generations.set(tabId, (generations.get(tabId) ?? 0) + 1)
}
