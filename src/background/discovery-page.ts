export interface DiscoveredFeed {
    url: string
    title: string
    type: string
    source: 'link' | 'page' | 'probe'
}

// This function is serialized by chrome.scripting.executeScript. Keep every
// dependency inside the function body; it cannot reference module imports.
export async function discoverPageFeeds(): Promise<DiscoveredFeed[]> {
    const pageUrl = location.href
    const contentType = document.contentType || ''
    const feedMime = /(rss|atom|rdf|feed\+json)/i
    const feedPath = /\.(rss|atom|rdf)(?:$|[?#])/i
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
    if (feedMime.test(contentType) || feedPath.test(path) || feedLikePath.test(path)) {
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
            !/\.(rss|atom|rdf|json)(?:$|[?#])/i.test(pathname) &&
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

    const basePath = path.replace(/\/+$/, '')
    const candidates = [
        `${basePath}.rss`,
        `${basePath}.atom`,
        `${basePath}/feed`,
        `${basePath}/rss`,
        `${basePath}/rss.xml`,
        `${basePath}/atom.xml`,
        '/feed',
        '/rss.xml',
        '/atom.xml',
        '/feed.json'
    ]
        .map(absoluteUrl)
        .filter((candidate): candidate is string => candidate !== null)

    const deadline = Date.now() + 4_000
    for (const candidate of candidates) {
        if (Date.now() >= deadline) break

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 1_500)
        try {
            const response = await fetch(candidate, {
                credentials: 'include',
                signal: controller.signal,
                headers: {
                    Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5'
                }
            })

            if (!response.ok) continue
            const text = await response.text()
            if (!looksLikeFeed(text)) continue

            return [
                {
                    url: response.url || candidate,
                    title: document.title || candidate,
                    type: response.headers.get('content-type') || '',
                    source: 'probe'
                }
            ]
        } catch {
            // A rejected candidate is not a feed; continue with the next one.
        } finally {
            clearTimeout(timer)
        }
    }

    return []
}
