import {afterEach, describe, expect, it, vi} from 'vitest'
import {
    clearDiscovery,
    detectTab,
    getActiveDiscovery
} from '../../src/background/discovery'
import {db} from '../../src/db/db'
import {seedFeed} from '../helpers/db'

function mockChrome(tab: {id: number; url: string} | null) {
    const get = vi.fn().mockResolvedValue(tab)
    const query = vi.fn().mockResolvedValue(tab ? [tab] : [])
    const executeScript = vi.fn().mockResolvedValue([
        {
            result: [
                {
                    url: 'https://example.com/feed.xml',
                    title: 'Feed',
                    type: 'application/rss+xml',
                    source: 'link'
                }
            ]
        }
    ])
    vi.stubGlobal('chrome', {
        tabs: {get, query},
        scripting: {executeScript}
    })
    return {get, query, executeScript}
}

afterEach(async () => {
    vi.unstubAllGlobals()
    clearDiscovery(1)
    await db.delete()
    await db.open()
})

describe('discovery cache', () => {
    it('reuses the cache for the same tab URL', async () => {
        const {executeScript} = mockChrome({
            id: 1,
            url: 'https://example.com/article'
        })

        const first = await detectTab(1)
        const second = await detectTab(1)

        expect(first.feeds).toHaveLength(1)
        expect(second.feeds).toHaveLength(1)
        expect(executeScript).toHaveBeenCalledTimes(1)
    })

    it('does not cache a result when the tab navigates during detection', async () => {
        const get = vi
            .fn()
            .mockResolvedValueOnce({id: 1, url: 'https://example.com/one'})
            .mockResolvedValueOnce({id: 1, url: 'https://example.com/two'})
            .mockResolvedValueOnce({id: 1, url: 'https://example.com/two'})
            .mockResolvedValueOnce({id: 1, url: 'https://example.com/two'})
        const executeScript = vi.fn().mockResolvedValue([
            {
                result: [
                    {
                        url: 'https://example.com/feed.xml',
                        title: 'Feed',
                        type: 'application/rss+xml',
                        source: 'link'
                    }
                ]
            }
        ])
        vi.stubGlobal('chrome', {
            tabs: {get, query: vi.fn()},
            scripting: {executeScript}
        })

        const first = await detectTab(1)
        expect(first.feeds).toEqual([])

        const second = await detectTab(1)
        expect(second.feeds).toHaveLength(1)
        expect(executeScript).toHaveBeenCalledTimes(2)
    })

    it('returns no feeds when injection fails', async () => {
        const get = vi.fn().mockResolvedValue({id: 1, url: 'https://example.com'})
        const executeScript = vi.fn().mockRejectedValue(new Error('blocked'))
        vi.stubGlobal('chrome', {
            tabs: {get, query: vi.fn()},
            scripting: {executeScript}
        })

        await expect(detectTab(1)).resolves.toMatchObject({feeds: []})
    })

    it('clears a tab cache on removal', async () => {
        const {executeScript} = mockChrome({
            id: 1,
            url: 'https://example.com/article'
        })

        await detectTab(1)
        clearDiscovery(1)
        await detectTab(1)

        expect(executeScript).toHaveBeenCalledTimes(2)
    })
})

describe('getActiveDiscovery', () => {
    it('marks subscribed feeds', async () => {
        mockChrome({id: 1, url: 'https://example.com/article'})
        await seedFeed({url: 'https://example.com/feed.xml'})

        const result = await getActiveDiscovery()

        expect(result).toMatchObject({
            tabId: 1,
            pageUrl: 'https://example.com/article',
            feeds: [{url: 'https://example.com/feed.xml', subscribed: true}]
        })
    })

    it('matches subscribed feeds after trailing-slash or fragment differences', async () => {
        const get = vi.fn().mockResolvedValue({
            id: 1,
            url: 'https://example.com/article'
        })
        const query = vi.fn().mockResolvedValue([{id: 1}])
        const executeScript = vi.fn().mockResolvedValue([
            {
                result: [
                    {
                        url: 'https://example.com/feed/#latest',
                        title: 'Feed',
                        type: 'application/rss+xml',
                        source: 'link'
                    }
                ]
            }
        ])
        vi.stubGlobal('chrome', {
            tabs: {get, query},
            scripting: {executeScript}
        })
        await seedFeed({url: 'https://example.com/feed/'})

        const result = await getActiveDiscovery()

        expect(result.feeds[0].subscribed).toBe(true)
    })

    it('matches a feed stored under its redirected final URL', async () => {
        const get = vi.fn().mockResolvedValue({
            id: 1,
            url: 'https://example.com/article'
        })
        const query = vi.fn().mockResolvedValue([{id: 1}])
        const executeScript = vi.fn().mockResolvedValue([
            {
                result: [
                    {
                        url: 'https://example.com/feed',
                        title: 'Feed',
                        type: 'application/rss+xml',
                        source: 'link'
                    }
                ]
            }
        ])
        vi.stubGlobal('chrome', {
            tabs: {get, query},
            scripting: {executeScript}
        })
        await seedFeed({
            url: 'https://cdn.example/feed-123',
            sourceUrl: 'https://example.com/feed'
        })

        const result = await getActiveDiscovery()

        expect(result.feeds[0].subscribed).toBe(true)
    })

    it('returns nulls when no tab is active', async () => {
        mockChrome(null)

        await expect(getActiveDiscovery()).resolves.toEqual({
            tabId: null,
            pageUrl: null,
            feeds: []
        })
    })
})
