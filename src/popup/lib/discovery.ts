import type {DiscoveryResult} from '@/background/discovery'

function redditJsonUrl(value: string): string {
    try {
        const url = new URL(value)
        if (url.hostname !== 'reddit.com' && url.hostname !== 'www.reddit.com') {
            return value
        }

        if (
            url.pathname === '/' ||
            url.pathname === '/.rss' ||
            url.pathname === '/.atom'
        ) {
            return 'https://www.reddit.com/.json'
        }

        const subreddit = url.pathname.match(
            /^\/r\/([A-Za-z0-9_]+)(?:\/|$|\.(?:rss|atom|json)$)/
        )
        return subreddit
            ? `https://www.reddit.com/r/${subreddit[1]}/.json`
            : value
    } catch {
        return value
    }
}

export function firstAddableFeedUrl(discovery: DiscoveryResult | null): string {
    const feed = discovery?.feeds.find((feed) => !feed.subscribed)
    return feed ? redditJsonUrl(feed.url) : ''
}
