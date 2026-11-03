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
        page('https://www.reddit.com/r/news.rss', '<html><body></body></html>')

        await expect(discoverPageFeeds()).resolves.toMatchObject([
            {
                url: 'https://www.reddit.com/r/news.rss',
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

    it('probes the Reddit-style .rss URL when no link exists', async () => {
        page('https://www.reddit.com/r/news', '<html><body>News</body></html>')
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>News</title></feed>',
                {status: 200, headers: {'content-type': 'application/atom+xml'}}
            )
        )
        vi.stubGlobal('fetch', fetchMock)

        const feeds = await discoverPageFeeds()

        expect(feeds).toMatchObject([
            {
                url: 'https://www.reddit.com/r/news.rss',
                source: 'probe'
            }
        ])
        expect(fetchMock.mock.calls[0][0]).toBe(
            'https://www.reddit.com/r/news.rss'
        )
    })

    it('rejects an HTML soft-404 and stops at the next candidate', async () => {
        page('https://example.com/article', '<html><body>Article</body></html>')
        const fetchMock = vi.fn(async (url: string) => {
            if (url.endsWith('.rss')) {
                return new Response('<html>Not found</html>', {status: 200})
            }
            return new Response('not a feed', {status: 404})
        })
        vi.stubGlobal('fetch', fetchMock)

        await expect(discoverPageFeeds()).resolves.toEqual([])
    })

    it('rejects an HTML body even when labeled as a feed', async () => {
        page('https://example.com/article', '<html><body>Article</body></html>')
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response('<html><body>Not found</body></html>', {
                    status: 200,
                    headers: {'content-type': 'application/rss+xml'}
                })
            )
        )

        await expect(discoverPageFeeds()).resolves.toEqual([])
    })

    it('returns no feeds when probing fails or times out', async () => {
        page('https://example.com/article', '<html><body>Article</body></html>')
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('aborted')))

        await expect(discoverPageFeeds()).resolves.toEqual([])
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
