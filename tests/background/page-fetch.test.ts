import {afterEach, describe, expect, it, vi} from 'vitest'
import {
    fetchFeedInTab,
    fetchInPage,
    findSameOriginTab
} from '../../src/background/page-fetch'

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('findSameOriginTab', () => {
    it('prefers an explicitly supplied same-origin tab', async () => {
        const get = vi.fn().mockResolvedValue({
            id: 7,
            url: 'https://example.com/article'
        })
        const query = vi.fn()
        vi.stubGlobal('chrome', {tabs: {get, query}})

        await expect(
            findSameOriginTab('https://example.com/feed.xml', 7)
        ).resolves.toBe(7)
        expect(query).not.toHaveBeenCalled()
    })

    it('falls back to any tab on the same origin', async () => {
        const get = vi.fn().mockResolvedValue({id: 7, url: 'https://other.com/page'})
        const query = vi.fn().mockResolvedValue([{id: 9, url: 'https://example.com/x'}])
        vi.stubGlobal('chrome', {tabs: {get, query}})

        await expect(
            findSameOriginTab('https://example.com/feed.xml', 7)
        ).resolves.toBe(9)
        expect(query).toHaveBeenCalledWith({url: 'https://example.com/*'})
    })

    it('returns null when no same-origin tab is open', async () => {
        vi.stubGlobal('chrome', {
            tabs: {
                get: vi.fn().mockRejectedValue(new Error('gone')),
                query: vi.fn().mockResolvedValue([])
            }
        })

        await expect(
            findSameOriginTab('https://example.com/feed.xml')
        ).resolves.toBeNull()
    })
})

describe('fetchFeedInTab', () => {
    it('returns the injected page result', async () => {
        const executeScript = vi.fn().mockResolvedValue([
            {result: {status: 'ok', text: '<feed/>', finalUrl: 'https://example.com/feed'}}
        ])
        vi.stubGlobal('chrome', {scripting: {executeScript}})

        await expect(
            fetchFeedInTab(4, 'https://example.com/feed')
        ).resolves.toEqual({
            status: 'ok',
            text: '<feed/>',
            finalUrl: 'https://example.com/feed'
        })
        expect(executeScript).toHaveBeenCalledWith(
            expect.objectContaining({
                target: {tabId: 4},
                args: ['https://example.com/feed']
            })
        )
    })

    it('returns an error when injection returns nothing', async () => {
        vi.stubGlobal('chrome', {scripting: {executeScript: vi.fn().mockResolvedValue([])}})

        await expect(
            fetchFeedInTab(4, 'https://example.com/feed')
        ).resolves.toEqual({
            status: 'error',
            error: 'Could not fetch the feed in the page'
        })
    })
})

describe('fetchInPage', () => {
    it('fetches with credentials and returns the text', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response('<feed/>', {status: 200})
        )
        vi.stubGlobal('fetch', fetchMock)

        await expect(fetchInPage('https://example.com/feed')).resolves.toEqual({
            status: 'ok',
            text: '<feed/>',
            finalUrl: 'https://example.com/feed'
        })
        expect(fetchMock).toHaveBeenCalledWith(
            'https://example.com/feed',
            expect.objectContaining({credentials: 'include'})
        )
    })

    it('reports an HTTP failure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', {status: 403})))

        await expect(fetchInPage('https://example.com/feed')).resolves.toEqual({
            status: 'error',
            error: 'HTTP 403'
        })
    })
})
