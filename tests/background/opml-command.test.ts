import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {handleCommand} from '../../src/background/messages'
import {db} from '../../src/db/db'

const opml = `<?xml version="1.0"?>
<opml version="2.0">
  <head><title>Subscriptions</title></head>
  <body>
    <outline text="Tech">
      <outline text="Nested">
        <outline text="Feed A" type="rss" xmlUrl="https://a.example.com/feed.xml"/>
        <outline text="Feed B" type="rss" xmlUrl="https://b.example.com/rss"/>
      </outline>
    </outline>
    <outline text="Root Feed" type="rss" xmlUrl="https://c.example.com/feed.atom"/>
  </body>
</opml>`

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

describe('opml commands', () => {
  it('imports nested folders and staggers the first fetches', async () => {
    const result = await handleCommand({type: 'opml:import', xml: opml})

    expect(result).toEqual({ok: true, data: {folders: 1, feeds: 3}})

    const folders = await db.folders.toArray()
    expect(folders.map((folder) => folder.name)).toEqual(['Tech / Nested'])

    const feeds = await db.feeds.toArray()
    expect(feeds).toHaveLength(3)

    const a = feeds.find((feed) => feed.url === 'https://a.example.com/feed.xml')
    const b = feeds.find((feed) => feed.url === 'https://b.example.com/rss')
    const c = feeds.find((feed) => feed.url === 'https://c.example.com/feed.atom')

    expect(a?.folderId).toBe(folders[0].id)
    expect(b?.folderId).toBe(folders[0].id)
    expect(c?.folderId).toBeNull()
    expect((b?.nextFetchAt ?? 0) - (a?.nextFetchAt ?? 0)).toBe(30_000)
  })

  it('skips duplicate URLs on a second import', async () => {
    await handleCommand({type: 'opml:import', xml: opml})
    const result = await handleCommand({type: 'opml:import', xml: opml})

    expect(result).toEqual({ok: true, data: {folders: 0, feeds: 0}})
    expect(await db.feeds.count()).toBe(3)
    expect(await db.folders.count()).toBe(1)
  })

  it('exports the stored feeds and folders', async () => {
    await handleCommand({type: 'opml:import', xml: opml})

    const result = await handleCommand({type: 'opml:export'})

    expect(result.ok).toBe(true)
    const xml = result.ok ? (result.data as string) : ''
    expect(xml).toContain('https://a.example.com/feed.xml')
    expect(xml).toContain('https://c.example.com/feed.atom')
    expect(xml).toContain('Tech / Nested')
  })
})
