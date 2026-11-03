import {db} from '../db/db'
import {discoverPageFeeds, type DiscoveredFeed} from './discovery-page'

const CACHE_TTL_MS = 10 * 60_000

interface CachedDiscovery {
    url: string
    feeds: DiscoveredFeed[]
    expiresAt: number
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

function isHttpUrl(url: string | undefined): url is string {
    return Boolean(url && /^https?:\/\//i.test(url))
}

async function withSubscribed(feeds: DiscoveredFeed[]): Promise<DiscoveryFeed[]> {
    const stored = await db.feeds.toArray()
    const urls = new Set(stored.map((feed) => feed.url))
    return feeds.map((feed) => ({...feed, subscribed: urls.has(feed.url)}))
}

export async function detectTab(
    tabId: number,
    options: {force?: boolean} = {}
): Promise<{tabId: number; pageUrl: string | null; feeds: DiscoveredFeed[]}> {
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
    const cached = cache.get(tabId)
    if (
        !options.force &&
        cached &&
        cached.url === pageUrl &&
        cached.expiresAt > Date.now()
    ) {
        return {tabId, pageUrl, feeds: cached.feeds}
    }

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

    cache.set(tabId, {
        url: pageUrl,
        feeds,
        expiresAt: Date.now() + CACHE_TTL_MS
    })
    return {tabId, pageUrl, feeds}
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

export async function hasUnsubscribedForTab(
    tabId: number,
    options: {force?: boolean} = {}
): Promise<boolean> {
    const result = await detectTab(tabId, options)
    const feeds = await withSubscribed(result.feeds)
    return feeds.some((feed) => !feed.subscribed)
}

export function clearDiscovery(tabId: number): void {
    cache.delete(tabId)
}
