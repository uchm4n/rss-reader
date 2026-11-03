export interface FetchFeedInput {
    url: string
    etag: string | null
    lastModified: string | null
}

export type FetchFeedResult =
    | {
    status: 'ok'
    finalUrl: string
    text: string
    etag: string | null
    lastModified: string | null
}
    | {
    status: 'not-modified'
    finalUrl: string
    etag: string | null
    lastModified: string | null
}
    | { status: 'error'; error: string }

const MAX_FEED_BYTES = 5 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 20_000

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message || 'Request failed'
    return String(error)
}

export async function fetchFeed(
    input: FetchFeedInput,
    fetchImpl: typeof fetch = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<FetchFeedResult> {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
    }, timeoutMs)

    const headers: Record<string, string> = {
        Accept:
            'application/rss+xml, application/atom+xml, application/feed+json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5'
    }
    if (input.etag) headers['If-None-Match'] = input.etag
    if (input.lastModified) headers['If-Modified-Since'] = input.lastModified

    try {
        const response = await fetchImpl(input.url, {
            headers,
            redirect: 'follow',
            signal: controller.signal
        })
        const finalUrl = response.url || input.url
        const etag = response.headers.get('etag') ?? input.etag
        const lastModified = response.headers.get('last-modified') ?? input.lastModified

        if (response.status === 304) {
            return {status: 'not-modified', finalUrl, etag, lastModified}
        }

        if (!response.ok) {
            return {status: 'error', error: `HTTP ${response.status}`}
        }

        const contentLength = Number(response.headers.get('content-length'))
        if (Number.isFinite(contentLength) && contentLength > MAX_FEED_BYTES) {
            return {status: 'error', error: 'Feed is larger than 5 MB'}
        }

        const text = await response.text()
        if (text.length > MAX_FEED_BYTES) {
            return {status: 'error', error: 'Feed is larger than 5 MB'}
        }

        return {status: 'ok', finalUrl, text, etag, lastModified}
    } catch (error) {
        return {
            status: 'error',
            error: timedOut ? 'Request timed out' : errorMessage(error)
        }
    } finally {
        clearTimeout(timer)
    }
}
