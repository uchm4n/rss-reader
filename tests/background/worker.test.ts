import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {refreshFeed, runDueFeeds} from '../../src/background/messages'
import {db} from '../../src/db/db'
import {postFixture, seedFeed} from '../helpers/db'

const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Worker feed</title>
  <link>https://example.com/</link>
  <description>Worker</description>
  <item><title>Post</title><link>https://example.com/post</link><guid>post</guid><description>Body</description></item>
</channel></rss>`

beforeEach(() => {
  vi.stubGlobal('chrome', {
    action: {
      setBadgeText: vi.fn(),
      setBadgeBackgroundColor: vi.fn(),
      setBadgeTextColor: vi.fn(),
      setIcon: vi.fn()
    },
    tabs: {
      get: vi.fn().mockRejectedValue(new Error('no tab')),
      query: vi.fn().mockResolvedValue([])
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([])
    }
  })
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await db.delete()
  await db.open()
})

async function seedFourDueFeeds() {
  for (let index = 1; index <= 4; index += 1) {
    await seedFeed({
      id: `feed-${index}`,
      url: `https://example.com/${index}.xml`,
      nextFetchAt: 0
    })
  }
}

describe('runDueFeeds', () => {
  it('drains more than one batch of due feeds', async () => {
    await seedFourDueFeeds()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(rss, {status: 200})))

    const result = await runDueFeeds(1_000)

    expect(result).toEqual({processed: 4, remaining: false})
    const feeds = await db.feeds.toArray()
    expect(feeds.every((feed) => feed.lastFetchedAt === 1_000)).toBe(true)
    expect(feeds.every((feed) => feed.errorCount === 0)).toBe(true)
  })

  it('refreshes a page-mode feed through an open same-origin tab', async () => {
    const feed = await seedFeed({
      id: 'page-feed',
      url: 'https://www.reddit.com/r/news.rss',
      fetchMode: 'page'
    })
    const chromeMock = globalThis.chrome as unknown as {
      tabs: {get: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn>}
      scripting: {executeScript: ReturnType<typeof vi.fn>}
    }
    chromeMock.tabs.get.mockResolvedValue({
      id: 3,
      url: 'https://www.reddit.com/r/news'
    })
    chromeMock.tabs.query.mockResolvedValue([
      {id: 3, url: 'https://www.reddit.com/r/news'}
    ])
    chromeMock.scripting.executeScript.mockResolvedValue([
      {result: {status: 'ok', text: rss, finalUrl: feed.url}}
    ])

    await expect(refreshFeed(feed.id, 1_000)).resolves.toEqual({inserted: 1})
    expect(await db.posts.count()).toBe(1)
    expect((await db.feeds.get(feed.id))?.lastError).toBeNull()
  })

  it('reports an open-tab error for a page-mode feed with no tab', async () => {
    const feed = await seedFeed({
      id: 'page-feed',
      url: 'https://www.reddit.com/r/news.rss',
      fetchMode: 'page'
    })
    await db.posts.add(postFixture({id: 'existing', feedId: feed.id}))

    await expect(refreshFeed(feed.id, 1_000)).resolves.toEqual({
      inserted: 0,
      error: 'Open a tab on this site to refresh'
    })

    const stored = await db.feeds.get(feed.id)
    expect(stored).toMatchObject({
      errorCount: 0,
      lastError: 'Open a tab on this site to refresh'
    })
    expect(stored?.nextFetchAt).toBeGreaterThan(1_000)
    expect(await db.posts.count()).toBe(1)
  })

  it('switches a background feed to page mode when the fallback succeeds', async () => {
    const feed = await seedFeed({
      id: 'blocked-feed',
      url: 'https://www.reddit.com/r/news.rss',
      fetchMode: 'background'
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', {status: 403})))
    const chromeMock = globalThis.chrome as unknown as {
      tabs: {get: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn>}
      scripting: {executeScript: ReturnType<typeof vi.fn>}
    }
    chromeMock.tabs.get.mockResolvedValue({
      id: 3,
      url: 'https://www.reddit.com/r/news'
    })
    chromeMock.tabs.query.mockResolvedValue([
      {id: 3, url: 'https://www.reddit.com/r/news'}
    ])
    chromeMock.scripting.executeScript.mockResolvedValue([
      {result: {status: 'ok', text: rss, finalUrl: feed.url}}
    ])

    await expect(refreshFeed(feed.id, 1_000)).resolves.toEqual({inserted: 1})
    expect((await db.feeds.get(feed.id))?.fetchMode).toBe('page')
    expect(await db.posts.count()).toBe(1)
  })

  it('backs off every feed when the batch fails', async () => {
    await seedFourDueFeeds()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )

    const result = await runDueFeeds(1_000)

    expect(result).toEqual({processed: 4, remaining: false})
    const feeds = await db.feeds.toArray()
    expect(feeds.every((feed) => feed.errorCount === 1)).toBe(true)
    expect(feeds.every((feed) => feed.lastError === 'offline')).toBe(true)
    expect(feeds.every((feed) => feed.nextFetchAt > 1_000)).toBe(true)
  })
})
