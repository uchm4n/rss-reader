import {afterEach, describe, expect, it, vi} from 'vitest'
import {
  FAVICON_TTL_MS,
  cacheFeedFavicon,
  cacheMissingFavicons,
  resolveFeedFavicon
} from '../../src/background/favicon'
import {db} from '../../src/db/db'
import {feedFixture} from '../helpers/db'

const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  ),
  (character) => character.charCodeAt(0)
)

function image(): Response {
  return new Response(PNG, {headers: {'content-type': 'image/png'}})
}

function html(body: string): Response {
  return new Response(body, {headers: {'content-type': 'text/html'}})
}

function stubFetch(routes: Record<string, () => Response>) {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const route = routes[url]
    return route ? route() : new Response('not found', {status: 404})
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await db.delete()
  await db.open()
})

describe('resolveFeedFavicon', () => {
  it('prefers /favicon.ico and stores it as a data URL', async () => {
    stubFetch({'https://example.com/favicon.ico': image})

    const result = await resolveFeedFavicon(
      {
        siteUrl: 'https://example.com/',
        feedUrl: 'https://example.com/feed.xml'
      },
      1_000
    )

    expect(result.favicon).toMatch(/^data:image\/png;base64,/)
    expect(result.faviconSourceUrl).toBe('https://example.com/favicon.ico')
    expect(result.faviconCachedAt).toBe(1_000)
  })

  it('falls back to the site icon link when /favicon.ico is missing', async () => {
    stubFetch({
      'https://example.com/': () =>
        html('<html><head><link rel="icon" href="/icon.png"></head></html>'),
      'https://example.com/icon.png': image
    })

    const result = await resolveFeedFavicon(
      {
        siteUrl: 'https://example.com/',
        feedUrl: 'https://example.com/feed.xml'
      },
      2_000
    )

    expect(result.favicon).toMatch(/^data:image\/png;base64,/)
    expect(result.faviconSourceUrl).toBe('https://example.com/icon.png')
  })

  it('falls back to the feed image when the site has no icon', async () => {
    stubFetch({
      'https://example.com/': () => html('<html><head></head></html>'),
      'https://example.com/feed-image.png': image
    })

    const result = await resolveFeedFavicon(
      {
        siteUrl: 'https://example.com/',
        feedUrl: 'https://example.com/feed.xml',
        feedImageUrl: 'https://example.com/feed-image.png'
      },
      3_000
    )

    expect(result.favicon).toMatch(/^data:image\/png;base64,/)
    expect(result.faviconSourceUrl).toBe('https://example.com/feed-image.png')
  })

  it('falls back to the active tab favicon last', async () => {
    vi.stubGlobal('chrome', {
      tabs: {
        get: vi.fn().mockResolvedValue({favIconUrl: 'https://example.com/tab.png'})
      }
    })
    stubFetch({'https://example.com/tab.png': image})

    const result = await resolveFeedFavicon(
      {
        siteUrl: 'https://example.com/',
        feedUrl: 'https://example.com/feed.xml',
        sourceTabId: 7
      },
      4_000
    )

    expect(result.favicon).toMatch(/^data:image\/png;base64,/)
    expect(result.faviconSourceUrl).toBe('https://example.com/tab.png')
  })

  it('rejects HTML responses and negative-caches the miss', async () => {
    stubFetch({
      'https://example.com/favicon.ico': () => html('<html>not an image</html>'),
      'https://example.com/': () => html('<html><head></head></html>')
    })

    const result = await resolveFeedFavicon(
      {
        siteUrl: 'https://example.com/',
        feedUrl: 'https://example.com/feed.xml'
      },
      5_000
    )

    expect(result.favicon).toBeNull()
    expect(result.faviconSourceUrl).toBeNull()
    expect(result.faviconCachedAt).toBe(5_000)
  })

  it('rejects images larger than the cache limit', async () => {
    stubFetch({
      'https://example.com/favicon.ico': () =>
        new Response(new Uint8Array(300 * 1024), {
          headers: {'content-type': 'image/png'}
        }),
      'https://example.com/': () => html('<html><head></head></html>')
    })

    const result = await resolveFeedFavicon(
      {
        siteUrl: 'https://example.com/',
        feedUrl: 'https://example.com/feed.xml'
      },
      6_000
    )

    expect(result.favicon).toBeNull()
  })
})

describe('cacheFeedFavicon', () => {
  it('skips a fresh cache', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const feed = feedFixture({
      favicon: 'data:image/png;base64,abc',
      faviconCachedAt: 1_000
    })

    await expect(cacheFeedFavicon(feed, {now: 2_000})).resolves.toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes a stale cache', async () => {
    stubFetch({'https://example.com/favicon.ico': image})
    const feed = feedFixture({
      siteUrl: 'https://example.com/',
      favicon: 'data:image/png;base64,old',
      faviconCachedAt: 1_000
    })

    const patch = await cacheFeedFavicon(feed, {
      now: 1_000 + FAVICON_TTL_MS + 1
    })

    expect(patch.favicon).toMatch(/^data:image\/png;base64,/)
    expect(patch.faviconSourceUrl).toBe('https://example.com/favicon.ico')
  })
})

describe('cacheMissingFavicons', () => {
  it('backfills only stale feeds', async () => {
    await db.feeds.bulkAdd([
      feedFixture({
        id: 'fresh',
        url: 'https://fresh.example/feed.xml',
        siteUrl: 'https://fresh.example/',
        favicon: 'data:image/png;base64,fresh',
        faviconCachedAt: 1_000
      }),
      feedFixture({
        id: 'stale',
        url: 'https://stale.example/feed.xml',
        siteUrl: 'https://stale.example/'
      })
    ])
    stubFetch({'https://stale.example/favicon.ico': image})

    await cacheMissingFavicons(10, 2_000)

    expect((await db.feeds.get('fresh'))?.favicon).toBe('data:image/png;base64,fresh')
    expect((await db.feeds.get('stale'))?.favicon).toMatch(/^data:image\/png;base64,/)
  })
})
