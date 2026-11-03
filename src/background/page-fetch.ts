const MAX_FEED_BYTES = 5 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20_000

export type PageFeedFetchResult =
    | {status: 'ok'; text: string; finalUrl: string}
    | {status: 'error'; error: string}

export async function fetchInPage(url: string): Promise<PageFeedFetchResult> {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
    }, FETCH_TIMEOUT_MS)

    try {
        const response = await fetch(url, {
            credentials: 'include',
            signal: controller.signal,
            headers: {
                Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5'
            }
        })

        if (!response.ok) {
            return {status: 'error', error: `HTTP ${response.status}`}
        }

        const contentLength = Number(response.headers.get('content-length'))
        if (Number.isFinite(contentLength) && contentLength > MAX_FEED_BYTES) {
            return {status: 'error', error: 'Feed is larger than 5 MB'}
        }

        const reader = response.body?.getReader()
        if (!reader) {
            const text = await response.text()
            return text.length > MAX_FEED_BYTES
                ? {status: 'error', error: 'Feed is larger than 5 MB'}
                : {status: 'ok', text, finalUrl: response.url || url}
        }

        const decoder = new TextDecoder()
        let text = ''
        let total = 0

        while (true) {
            const {done, value} = await reader.read()
            if (done) break

            total += value.byteLength
            if (total > MAX_FEED_BYTES) {
                await reader.cancel().catch(() => {})
                return {status: 'error', error: 'Feed is larger than 5 MB'}
            }
            text += decoder.decode(value, {stream: true})
        }

        text += decoder.decode()
        return {status: 'ok', text, finalUrl: response.url || url}
    } catch (error) {
        return {
            status: 'error',
            error: timedOut
                ? 'Request timed out'
                : error instanceof Error
                  ? error.message
                  : String(error)
        }
    } finally {
        clearTimeout(timer)
    }
}

export async function fetchFeedInTab(
    tabId: number,
    url: string
): Promise<PageFeedFetchResult> {
    try {
        const results = await chrome.scripting.executeScript({
            target: {tabId},
            func: fetchInPage,
            args: [url]
        })
        const result = results[0]?.result
        if (!result) {
            return {status: 'error', error: 'Could not fetch the feed in the page'}
        }
        return result
    } catch (error) {
        return {
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
        }
    }
}

export async function findSameOriginTab(
    url: string,
    preferredTabId?: number
): Promise<number | null> {
    let origin: string
    try {
        origin = new URL(url).origin
    } catch {
        return null
    }

    if (preferredTabId !== undefined) {
        try {
            const tab = await chrome.tabs.get(preferredTabId)
            if (
                tab.id !== undefined &&
                tab.url &&
                !tab.discarded &&
                new URL(tab.url).origin === origin
            ) {
                return tab.id
            }
        } catch {
            // The preferred tab may have closed; try any same-origin tab.
        }
    }

    const tabs = await chrome.tabs.query({url: `${origin}/*`})
    return (
        tabs.find(
            (tab) =>
                typeof tab.id === 'number' &&
                !tab.discarded &&
                Boolean(tab.url) &&
                new URL(tab.url!).origin === origin
        )?.id ?? null
    )
}
