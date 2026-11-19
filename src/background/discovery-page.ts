export interface DiscoveredFeed {
    url: string
    title: string
    type: string
    source: 'link' | 'page' | 'reddit'
}

// This function is serialized by chrome.scripting.executeScript. Keep every
// dependency inside the function body; it cannot reference module imports.
export async function discoverPageFeeds(): Promise<DiscoveredFeed[]> {
    const pageUrl = location.href
    const contentType = document.contentType || ''
    const feedMime = /(rss|atom|rdf|feed\+json)/i
    const feedPath = /\.(rss|atom|rdf)(\.xml)?(?:$|[?#])/i
    const feedLikePath = /(^|\/)(feed|rss|atom)(\/|$)/i
    const seen = new Set<string>()
    const feeds: DiscoveredFeed[] = []

    const absoluteUrl = (href: string): string | null => {
        try {
            const url = new URL(href, location.href)
            return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
        } catch {
            return null
        }
    }

    const add = (feed: DiscoveredFeed) => {
        if (seen.has(feed.url)) return
        seen.add(feed.url)
        feeds.push(feed)
    }

    const looksLikeFeed = (text: string): boolean => {
        const head = text.slice(0, 4096).trimStart()
        const lower = head.toLowerCase()

        if (/<rss[\s>]/i.test(head) || /<feed[\s>]/i.test(head) || /<rdf:rdf[\s>]/i.test(head)) {
            return true
        }
        return (
            head.startsWith('{') &&
            lower.includes('"version"') &&
            lower.includes('"items"')
        )
    }

    const path = location.pathname
    const bodyIsFeed =
        /(xml|text\/plain|json)/i.test(contentType) &&
        looksLikeFeed(document.body?.textContent?.slice(0, 4096) ?? '')

    if (
        feedMime.test(contentType) ||
        bodyIsFeed ||
        feedPath.test(path) ||
        feedLikePath.test(path)
    ) {
        return [
            {
                url: pageUrl,
                title: document.title || pageUrl,
                type: contentType,
                source: 'page'
            }
        ]
    }

    for (const link of document.querySelectorAll('link[rel~="alternate"][href]')) {
        const type = link.getAttribute('type') || ''
        const href = link.getAttribute('href') || ''
        const url = absoluteUrl(href)
        if (!url) continue

        let pathname = ''
        try {
            pathname = new URL(url).pathname
        } catch {
            continue
        }
        if (
            !feedMime.test(type) &&
            !/\.(rss|atom|rdf)(?:$|[?#])/i.test(pathname) &&
            !feedLikePath.test(pathname)
        ) {
            continue
        }

        add({
            url,
            title: link.getAttribute('title') || document.title || url,
            type,
            source: 'link'
        })
    }

    if (feeds.length) return feeds

    const host = location.hostname
    const redditHost = host === 'reddit.com' || host === 'www.reddit.com'
    const subreddit = redditHost ? path.match(/^\/r\/([A-Za-z0-9_]+)\/?$/) : null

    if (subreddit) {
        const url = `https://www.reddit.com/r/${subreddit[1]}.rss`
        add({
            url,
            title: document.title || url,
            type: 'application/rss+xml',
            source: 'reddit'
        })
    }

    return feeds
}
