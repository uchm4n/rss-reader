export type PageFeedFetchResult =
    | {status: 'ok'; text: string; finalUrl: string}
    | {status: 'error'; error: string}

export async function fetchInPage(url: string): Promise<PageFeedFetchResult> {
    try {
        const response = await fetch(url, {
            credentials: 'include',
            headers: {
                Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5'
            }
        })

        if (!response.ok) {
            return {status: 'error', error: `HTTP ${response.status}`}
        }

        const text = await response.text()
        if (text.length > 5 * 1024 * 1024) {
            return {status: 'error', error: 'Feed is larger than 5 MB'}
        }

        return {status: 'ok', text, finalUrl: response.url || url}
    } catch (error) {
        return {
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
        }
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
            if (tab.id !== undefined && tab.url && new URL(tab.url).origin === origin) {
                return tab.id
            }
        } catch {
            // The preferred tab may have closed; try any same-origin tab.
        }
    }

    const tabs = await chrome.tabs.query({url: `${origin}/*`})
    return tabs.find((tab) => typeof tab.id === 'number')?.id ?? null
}
