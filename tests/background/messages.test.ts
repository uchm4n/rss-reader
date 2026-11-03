import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {
  handleCommand,
  normalizeFeedUrl,
  type Command
} from '../../src/background/messages'
import {db} from '../../src/db/db'
import {postFixture, seedFeed} from '../helpers/db'

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

describe('normalizeFeedUrl', () => {
  it('trims and keeps http(s) URLs', () => {
    expect(normalizeFeedUrl('  https://example.com/feed.xml  ')).toBe(
      'https://example.com/feed.xml'
    )
    expect(normalizeFeedUrl('http://example.com/rss')).toBe('http://example.com/rss')
  })

  it('rejects empty, relative and non-http URLs', () => {
    for (const value of ['', '   ', 'example.com/feed.xml', 'ftp://example.com/feed']) {
      expect(() => normalizeFeedUrl(value)).toThrow('Enter a valid http(s) feed URL')
    }
  })
})

describe('handleCommand', () => {
  it('rejects a duplicate feed URL', async () => {
    await seedFeed({id: 'feed-1', url: 'https://example.com/feed.xml'})

    const result = await handleCommand({
      type: 'feed:add',
      url: 'https://example.com/feed.xml'
    })

    expect(result).toEqual({ok: false, error: 'Feed already exists'})
  })

  it('stores a successful background add as background mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          '<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><link>https://example.com/</link><description>d</description><item><title>One</title><link>https://example.com/1</link><guid>g1</guid><description>body</description></item></channel></rss>',
          {status: 200}
        )
      )
    )

    const result = await handleCommand({
      type: 'feed:add',
      url: 'https://example.com/feed.xml'
    })

    expect(result.ok).toBe(true)
    const feeds = await db.feeds.toArray()
    expect(feeds[0]).toMatchObject({fetchMode: 'background', url: 'https://example.com/feed.xml'})
  })

  it('caches a feed favicon as a data URL on add', async () => {
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
      ),
      (character) => character.charCodeAt(0)
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url
        if (url === 'https://example.com/favicon.ico') {
          return new Response(png, {headers: {'content-type': 'image/png'}})
        }
        return new Response(
          '<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><link>https://example.com/</link><description>d</description><item><title>One</title><link>https://example.com/1</link><guid>g1</guid><description>body</description></item></channel></rss>',
          {status: 200}
        )
      })
    )

    const result = await handleCommand({
      type: 'feed:add',
      url: 'https://example.com/feed.xml'
    })

    expect(result.ok).toBe(true)
    const feed = (await db.feeds.toArray())[0]
    expect(feed.favicon).toMatch(/^data:image\/png;base64,/)
    expect(feed.faviconSourceUrl).toBe('https://example.com/favicon.ico')
    expect(feed.faviconCachedAt).toBeTypeOf('number')
  })

  it('falls back to a same-origin page fetch when the background fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('blocked', {status: 403})))
    const executeScript = vi.fn().mockResolvedValue([
      {
        result: {
          status: 'ok',
          text: '<?xml version="1.0"?><rss version="2.0"><channel><title>Page Feed</title><link>https://example.com/</link><description>d</description><item><title>One</title><link>https://example.com/1</link><guid>g1</guid><description>body</description></item></channel></rss>',
          finalUrl: 'https://example.com/feed.xml'
        }
      }
    ])
    const chromeMock = globalThis.chrome as unknown as {
      tabs: {get: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn>}
      scripting: {executeScript: ReturnType<typeof vi.fn>}
    }
    chromeMock.tabs.get.mockResolvedValue({id: 5, url: 'https://example.com/article'})
    chromeMock.scripting.executeScript = executeScript

    const result = await handleCommand({
      type: 'feed:add',
      url: 'https://example.com/feed.xml',
      sourceTabId: 5
    })

    expect(result.ok).toBe(true)
    const feed = (await db.feeds.toArray())[0]
    expect(feed).toMatchObject({fetchMode: 'page', title: 'Page Feed'})
    expect(await db.posts.count()).toBe(1)
  })

  it('rejects a duplicate after canonical URL normalization', async () => {
    await seedFeed({id: 'feed-1', url: 'https://example.com/feed'})

    const result = await handleCommand({
      type: 'feed:add',
      url: 'https://example.com/feed/'
    })

    expect(result).toEqual({ok: false, error: 'Feed already exists'})
  })

  it('rejects a duplicate discovered under its original redirected URL', async () => {
    await seedFeed({
      id: 'feed-1',
      url: 'https://cdn.example/feed-123',
      sourceUrl: 'https://example.com/feed'
    })

    const result = await handleCommand({
      type: 'feed:add',
      url: 'https://example.com/feed'
    })

    expect(result).toEqual({ok: false, error: 'Feed already exists'})
  })

  it('moves feeds to the root when a folder is deleted', async () => {
    await db.folders.add({
      id: 'folder-1',
      name: 'Tech',
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1
    })
    await seedFeed({id: 'feed-1', folderId: 'folder-1'})
    await seedFeed({
      id: 'feed-2',
      url: 'https://example.com/two.xml',
      folderId: 'folder-1'
    })

    const result = await handleCommand({type: 'folder:delete', id: 'folder-1'})

    expect(result.ok).toBe(true)
    expect(await db.folders.get('folder-1')).toBeUndefined()
    expect((await db.feeds.get('feed-1'))?.folderId).toBeNull()
    expect((await db.feeds.get('feed-2'))?.folderId).toBeNull()
  })

  it('deletes a feed and its posts', async () => {
    await seedFeed({id: 'feed-1'})
    await db.posts.add(postFixture({id: 'feed-1:p1', feedId: 'feed-1'}))

    const result = await handleCommand({type: 'feed:delete', id: 'feed-1'})

    expect(result.ok).toBe(true)
    expect(await db.feeds.get('feed-1')).toBeUndefined()
    expect(await db.posts.count()).toBe(0)
  })

  it('validates folder commands', async () => {
    await expect(handleCommand({type: 'folder:add', name: '  '})).resolves.toEqual({
      ok: false,
      error: 'Folder name is required'
    })
    await expect(
      handleCommand({type: 'folder:update', id: 'missing', patch: {name: 'New'}})
    ).resolves.toEqual({ok: false, error: 'Folder not found'})
  })

  it('updates feed metadata and folder assignment', async () => {
    await seedFeed({id: 'feed-1'})
    await db.folders.add({
      id: 'folder-1',
      name: 'Tech',
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1
    })

    const result = await handleCommand({
      type: 'feed:update',
      id: 'feed-1',
      patch: {title: 'Renamed', folderId: 'folder-1', refreshInterval: 300}
    })

    expect(result.ok).toBe(true)
    expect(await db.feeds.get('feed-1')).toMatchObject({
      title: 'Renamed',
      folderId: 'folder-1',
      refreshInterval: 300
    })
  })

  it('adds and renames folders in sort order', async () => {
    await expect(handleCommand({type: 'folder:add', name: 'Tech'})).resolves.toEqual({
      ok: true
    })
    await expect(handleCommand({type: 'folder:add', name: 'News'})).resolves.toEqual({
      ok: true
    })

    const folders = await db.folders.orderBy('sortOrder').toArray()
    expect(folders.map((folder) => folder.name)).toEqual(['Tech', 'News'])

    const result = await handleCommand({
      type: 'folder:update',
      id: folders[0].id,
      patch: {name: 'Technology'}
    })

    expect(result.ok).toBe(true)
    expect((await db.folders.get(folders[0].id))?.name).toBe('Technology')
  })

  it('reschedules feeds with the current intervals', async () => {
    await seedFeed({id: 'feed-1', nextFetchAt: 1})
    await seedFeed({
      id: 'feed-2',
      url: 'https://example.com/two.xml',
      nextFetchAt: 1,
      refreshInterval: 120
    })

    const before = Date.now()
    await expect(handleCommand({type: 'worker:reschedule'})).resolves.toEqual({
      ok: true
    })

    const global = await db.feeds.get('feed-1')
    const override = await db.feeds.get('feed-2')
    expect(global?.nextFetchAt).toBeGreaterThanOrEqual(before + 900_000)
    expect(global?.nextFetchAt).toBeLessThan(before + 905_000)
    expect(override?.nextFetchAt).toBeGreaterThanOrEqual(before + 120_000)
    expect(override?.nextFetchAt).toBeLessThan(before + 125_000)
  })

  it('does not reschedule a feed on a title-only edit', async () => {
    await seedFeed({id: 'feed-1', nextFetchAt: 123_456})

    await handleCommand({
      type: 'feed:update',
      id: 'feed-1',
      patch: {title: 'Renamed'}
    })

    expect((await db.feeds.get('feed-1'))?.nextFetchAt).toBe(123_456)
  })

  it('validates feed commands', async () => {
    await expect(
      handleCommand({type: 'feed:update', id: 'missing', patch: {title: 'New'}})
    ).resolves.toEqual({ok: false, error: 'Feed not found'})
  })

  it('rejects unknown commands', async () => {
    await expect(
      handleCommand({type: 'nope'} as unknown as Command)
    ).resolves.toEqual({ok: false, error: 'Unknown command'})
  })
})
