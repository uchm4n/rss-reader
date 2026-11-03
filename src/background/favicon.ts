import {db} from '../db/db'
import type {Feed} from '../db/types'

export const FAVICON_TTL_MS = 30 * 24 * 60 * 60 * 1000

const MAX_FAVICON_BYTES = 256 * 1024
const FETCH_TIMEOUT_MS = 3_000
const SITE_HTML_LIMIT = 512 * 1024

export interface FaviconResult {
    favicon: string | null
    faviconSourceUrl: string | null
    faviconCachedAt: number
}

interface FaviconInput {
    siteUrl: string | null
    feedUrl: string
    feedImageUrl?: string | null
    sourceTabId?: number
}

function isHttpUrl(url: string): boolean {
    return /^https?:\/\//i.test(url)
}

function originOf(siteUrl: string | null, feedUrl: string): string | null {
    try {
        return new URL('/', siteUrl ?? feedUrl).toString()
    } catch {
        return null
    }
}

function faviconIcoUrl(siteUrl: string | null, feedUrl: string): string | null {
    const origin = originOf(siteUrl, feedUrl)
    return origin ? new URL('/favicon.ico', origin).toString() : null
}

function decodeEntities(value: string): string {
    return value
        .replace(/&amp;/gi, '&')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
            String.fromCodePoint(Number.parseInt(hex, 16))
        )
        .replace(/&#(\d+);/g, (_, decimal: string) =>
            String.fromCodePoint(Number.parseInt(decimal, 10))
        )
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
        return await fetch(url, {...init, signal: controller.signal})
    } finally {
        clearTimeout(timer)
    }
}

function toDataUrl(buffer: ArrayBuffer, contentType: string): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunkSize = 0x8000

    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
    }

    return `data:${contentType};base64,${btoa(binary)}`
}

async function imageDataUrl(url: string): Promise<string | null> {
    if (url.startsWith('data:image/')) {
        return url.length <= MAX_FAVICON_BYTES * 2 ? url : null
    }
    if (!isHttpUrl(url)) return null

    try {
        const response = await fetchWithTimeout(url, {
            headers: {Accept: 'image/*'},
            redirect: 'follow'
        })
        if (!response.ok) return null

        const contentType = (response.headers.get('content-type') ?? '')
            .split(';')[0]
            .trim()
            .toLowerCase()
        if (!contentType.startsWith('image/')) return null

        const contentLength = Number(response.headers.get('content-length'))
        if (Number.isFinite(contentLength) && contentLength > MAX_FAVICON_BYTES) {
            return null
        }

        const buffer = await response.arrayBuffer()
        if (buffer.byteLength > MAX_FAVICON_BYTES) return null
        return toDataUrl(buffer, contentType)
    } catch {
        return null
    }
}

async function siteIconUrls(siteUrl: string | null): Promise<string[]> {
    if (!siteUrl) return []

    try {
        const response = await fetchWithTimeout(siteUrl, {
            headers: {Accept: 'text/html'}
        })
        if (!response.ok) return []

        const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
        if (contentType && !/text\/html|application\/xhtml/.test(contentType)) return []

        const contentLength = Number(response.headers.get('content-length'))
        if (Number.isFinite(contentLength) && contentLength > SITE_HTML_LIMIT) {
            return []
        }

        const text = (await response.text()).slice(0, SITE_HTML_LIMIT)
        const urls: string[] = []

        for (const tag of text.match(/<link\b[^>]*>/gi) ?? []) {
            const rel = /\brel\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? ''
            if (!/(^|\s)icon(\s|$)/i.test(rel) && !/apple-touch-icon/i.test(rel)) continue

            const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
            if (!href) continue

            try {
                const url = new URL(decodeEntities(href), siteUrl).toString()
                if (isHttpUrl(url)) urls.push(url)
            } catch {
                // Ignore malformed icon links.
            }
        }

        return urls
    } catch {
        return []
    }
}

async function activeTabFavicon(sourceTabId?: number): Promise<string | null> {
    if (sourceTabId === undefined) return null

    try {
        const tab = await chrome.tabs.get(sourceTabId)
        const url = tab.favIconUrl
        return url && (isHttpUrl(url) || url.startsWith('data:image/')) ? url : null
    } catch {
        return null
    }
}

async function faviconCandidates(input: FaviconInput): Promise<string[]> {
    const urls: string[] = []
    const add = (url: string | null | undefined) => {
        if (url && !urls.includes(url)) urls.push(url)
    }

    add(faviconIcoUrl(input.siteUrl, input.feedUrl))
    for (const url of await siteIconUrls(input.siteUrl)) add(url)
    add(input.feedImageUrl)
    add(await activeTabFavicon(input.sourceTabId))

    return urls
}

export async function resolveFeedFavicon(
    input: FaviconInput,
    now = Date.now()
): Promise<FaviconResult> {
    for (const url of await faviconCandidates(input)) {
        const favicon = await imageDataUrl(url)
        if (favicon) return {favicon, faviconSourceUrl: url, faviconCachedAt: now}
    }

    return {favicon: null, faviconSourceUrl: null, faviconCachedAt: now}
}

export function isFaviconFresh(
    feed: Pick<Feed, 'faviconCachedAt'>,
    now = Date.now()
): boolean {
    return (
        feed.faviconCachedAt != null &&
        now - feed.faviconCachedAt < FAVICON_TTL_MS
    )
}

export async function cacheFeedFavicon(
    feed: Feed,
    options: {
        feedImageUrl?: string | null
        sourceTabId?: number
        now?: number
    } = {}
): Promise<Partial<Feed>> {
    const now = options.now ?? Date.now()
    if (isFaviconFresh(feed, now)) return {}

    const result = await resolveFeedFavicon(
        {
            siteUrl: feed.siteUrl,
            feedUrl: feed.url,
            feedImageUrl:
                options.feedImageUrl ??
                (feed.favicon && isHttpUrl(feed.favicon) ? feed.favicon : null),
            sourceTabId: options.sourceTabId
        },
        now
    )

    return {
        favicon: result.favicon ?? feed.favicon,
        faviconSourceUrl: result.faviconSourceUrl ?? feed.faviconSourceUrl ?? null,
        faviconCachedAt: result.faviconCachedAt
    }
}

export async function cacheMissingFavicons(
    limit = 8,
    now = Date.now()
): Promise<void> {
    const feeds = await db.feeds.toArray()
    const stale = feeds.filter((feed) => !isFaviconFresh(feed, now)).slice(0, limit)

    await Promise.all(
        stale.map(async (feed) => {
            const patch = await cacheFeedFavicon(feed, {now})
            if (Object.keys(patch).length) {
                await db.feeds.update(feed.id, patch)
            }
        })
    )
}
