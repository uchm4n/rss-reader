import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {runDueFeeds} from '../../src/background/messages'
import {db} from '../../src/db/db'
import {seedFeed} from '../helpers/db'

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
