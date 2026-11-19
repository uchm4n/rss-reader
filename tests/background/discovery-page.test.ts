// @vitest-environment jsdom
import {JSDOM} from 'jsdom'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {discoverPageFeeds} from '../../src/background/discovery-page'

function page(url: string, html: string, contentType = 'text/html') {
    const dom = new JSDOM(html, {url})
    Object.defineProperty(dom.window.document, 'contentType', {value: contentType})
    vi.stubGlobal('document', dom.window.document)
    vi.stubGlobal('location', dom.window.location)
    vi.stubGlobal('window', dom.window)
    return dom
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('discoverPageFeeds', () => {
    it('reads alternate feed links and resolves relative URLs', async () => {
        page(
            'https://example.com/article',
            '<html><head><link rel="alternate" type="application/rss+xml" title="Main feed" href="/feed.xml"></head><body></body></html>'
        )

        await expect(discoverPageFeeds()).resolves.toEqual([
            {
                url: 'https://example.com/feed.xml',
                title: 'Main feed',
                type: 'application/rss+xml',
                source: 'link'
            }
        ])
    })

    it('returns multiple distinct feed links', async () => {
        page(
            'https://example.com/article',
            `<html><head>
                <link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml">
                <link rel="alternate" type="application/atom+xml" title="Atom" href="/atom.xml">
            </head></html>`
        )

        const feeds = await discoverPageFeeds()
        expect(feeds.map((feed) => feed.url)).toEqual([
            'https://example.com/feed.xml',
            'https://example.com/atom.xml'
        ])
    })

    it('deduplicates multiple links to the same feed', async () => {
        page(
            'https://example.com/article',
            `<html><head>
                <link rel="alternate" type="application/rss+xml" href="/feed.xml">
                <link rel="alternate" type="application/atom+xml" href="/feed.xml">
            </head></html>`
        )

        const feeds = await discoverPageFeeds()
        expect(feeds).toHaveLength(1)
        expect(feeds[0].url).toBe('https://example.com/feed.xml')
    })

    it('treats the current feed URL as a feed', async () => {
        page('https://example.com/feed.rss', '<html><body></body></html>')

        await expect(discoverPageFeeds()).resolves.toMatchObject([
            {
                url: 'https://example.com/feed.rss',
                source: 'page'
            }
        ])
    })

    it('treats a feed content type as a feed', async () => {
        page(
            'https://example.com/subscribe',
            '<html><body></body></html>',
            'application/atom+xml'
        )

        await expect(discoverPageFeeds()).resolves.toMatchObject([
            {
                url: 'https://example.com/subscribe',
                source: 'page'
            }
        ])
    })

    it('detects an XML feed served with a generic XML type', async () => {
        page(
            'https://example.com/rss.xml',
            '<html><body><pre>&lt;rss version="2.0"&gt;&lt;channel/&gt;&lt;/rss&gt;</pre></body></html>',
            'application/xml'
        )

        await expect(discoverPageFeeds()).resolves.toMatchObject([
            {
                url: 'https://example.com/rss.xml',
                source: 'page'
            }
        ])
    })

    it('detects a JSON Feed served as application/json', async () => {
        page(
            'https://example.com/feed.json',
            '<html><body><pre>{"version":"https://jsonfeed.org/version/1.1","items":[]}</pre></body></html>',
            'application/json'
        )

        await expect(discoverPageFeeds()).resolves.toMatchObject([
            {
                url: 'https://example.com/feed.json',
                source: 'page'
            }
        ])
    })

    it('derives a Reddit subreddit JSON feed without fetching', async () => {
        page(
            'https://www.reddit.com/r/news/',
            '<html><head><title>News</title></head><body>News</body></html>'
        )
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)

        await expect(discoverPageFeeds()).resolves.toEqual([
            {
                url: 'https://www.reddit.com/r/news/.json',
                title: 'News',
                type: 'application/json',
                source: 'reddit'
            }
        ])
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('derives a Reddit feed from a bare subreddit path', async () => {
        page('https://reddit.com/r/news', '<html><body>News</body></html>')
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)

        await expect(discoverPageFeeds()).resolves.toMatchObject([
            {url: 'https://www.reddit.com/r/news/.json', source: 'reddit'}
        ])
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('derives the popular subreddit JSON feed', async () => {
        page(
            'https://www.reddit.com/r/popular',
            '<html><head><title>Popular</title></head><body>Popular</body></html>'
        )

        await expect(discoverPageFeeds()).resolves.toEqual([
            {
                url: 'https://www.reddit.com/r/popular/.json',
                title: 'Popular',
                type: 'application/json',
                source: 'reddit'
            }
        ])
    })

    it('derives the Reddit home JSON feed', async () => {
        page(
            'https://www.reddit.com/',
            '<html><head><title>Reddit</title></head><body>Home</body></html>'
        )

        await expect(discoverPageFeeds()).resolves.toEqual([
            {
                url: 'https://www.reddit.com/.json',
                title: 'Reddit',
                type: 'application/json',
                source: 'reddit'
            }
        ])
    })

    it('derives the subreddit feed from a post page', async () => {
        page(
            'https://www.reddit.com/r/news/comments/abc123/title/',
            '<html><body>Post</body></html>'
        )

        await expect(discoverPageFeeds()).resolves.toMatchObject([
            {url: 'https://www.reddit.com/r/news/.json', source: 'reddit'}
        ])
    })

    it('upgrades a Reddit .rss URL to JSON', async () => {
        page('https://www.reddit.com/r/news/.rss', '<html><body>Legacy</body></html>')

        await expect(discoverPageFeeds()).resolves.toMatchObject([
            {url: 'https://www.reddit.com/r/news/.json', source: 'reddit'}
        ])
    })

    it('ignores Reddit .rss links and derives the JSON feed', async () => {
        page(
            'https://www.reddit.com/r/news/',
            '<html><head><link rel="alternate" type="application/rss+xml" title="RSS" href="/r/news/.rss"></head><body>News</body></html>'
        )

        await expect(discoverPageFeeds()).resolves.toMatchObject([
            {url: 'https://www.reddit.com/r/news/.json', source: 'reddit'}
        ])
    })

    it('does not derive feeds for non-canonical Reddit hosts', async () => {
        page(
            'https://reddit.com.evil.test/r/news/',
            '<html><body>Not Reddit</body></html>'
        )
        await expect(discoverPageFeeds()).resolves.toEqual([])

        page(
            'https://old.reddit.com/r/news/',
            '<html><body>Old Reddit</body></html>'
        )
        await expect(discoverPageFeeds()).resolves.toEqual([])
    })

    it('does not derive a feed for Reddit search pages', async () => {
        page('https://www.reddit.com/search?q=news', '<html><body>Search</body></html>')

        await expect(discoverPageFeeds()).resolves.toEqual([])
    })

    it('returns no feeds and makes no requests for a generic page', async () => {
        page(
            'https://example.com/search?q=localhost:8000',
            '<html><body>Results</body></html>'
        )
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)

        await expect(discoverPageFeeds()).resolves.toEqual([])
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('drops non-http feed links', async () => {
        page(
            'https://example.com/article',
            `<html><head>
                <link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">
                <link rel="alternate" type="application/rss+xml" href="file:///tmp/feed.xml">
            </head></html>`
        )

        await expect(discoverPageFeeds()).resolves.toEqual([])
    })
})
