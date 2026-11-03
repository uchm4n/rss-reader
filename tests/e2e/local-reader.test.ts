import {afterAll, afterEach, beforeAll, describe, expect, it} from 'vitest'
import {fetchFeed} from '../../src/background/fetcher'
import {ingestFeed} from '../../src/background/ingest'
import {db} from '../../src/db/db'
import {parseFeedDocument} from '../../src/shared/parser/parse-feed'
import {parseOpmlFeeds} from '../../src/shared/parser/parse-opml'
import {feedFixture} from '../helpers/db'
import {startFixtureServer} from './fixture-server.mjs'

let fixture: Awaited<ReturnType<typeof startFixtureServer>>

beforeAll(async () => {
  fixture = await startFixtureServer()
})

afterAll(async () => {
  await fixture.close()
})

afterEach(async () => {
  await db.delete()
  await db.open()
})

async function loadFeed(path: string) {
  const result = await fetchFeed({
    url: `${fixture.url}${path}`,
    etag: null,
    lastModified: null
  })
  if (result.status === 'error') throw new Error(result.error)
  if (result.status === 'not-modified') throw new Error('Unexpected not-modified response')

  return {parsed: parseFeedDocument(result.text), text: result.text}
}

describe('local reader end-to-end data flow', () => {
  it('imports a first fetch as read and keeps the newest 200', async () => {
    const feed = feedFixture({url: `${fixture.url}/rss.xml`})
    await db.feeds.add(feed)
    const {parsed} = await loadFeed('/rss.xml')

    const result = await ingestFeed(feed, parsed, {
      retention: 200,
      firstFetch: true,
      now: 1_000
    })

    expect(result).toEqual({inserted: 3, trimmed: 0, unread: 0})
    const posts = await db.posts.toArray()
    expect(posts).toHaveLength(3)
    expect(posts.every((post) => post.status)).toBe(true)

    const retentionFeed = feedFixture({
      id: 'retention-feed',
      url: `${fixture.url}/retention.xml`
    })
    await db.feeds.add(retentionFeed)
    const retention = await loadFeed('/retention.xml')
    const retained = await ingestFeed(retentionFeed, retention.parsed, {
      retention: 200,
      firstFetch: true,
      now: 2_000
    })

    expect(retained).toEqual({inserted: 201, trimmed: 1, unread: 0})
    expect(
      await db.posts.where('feedId').equals('retention-feed').count()
    ).toBe(200)
    expect(
      await db.posts.where('feedId').equals('retention-feed').and((post) => !post.status).count()
    ).toBe(0)
  })

  it('adds a later fetch as unread at the top', async () => {
    const feed = feedFixture({url: `${fixture.url}/rss.xml`})
    await db.feeds.add(feed)

    const first = await loadFeed('/rss.xml')
    await ingestFeed(feed, first.parsed, {retention: 200, firstFetch: true, now: 1_000})

    await fetch(`${fixture.url}/add-item`)
    const second = await loadFeed('/rss.xml')
    const result = await ingestFeed(feed, second.parsed, {
      retention: 200,
      firstFetch: false,
      now: 2_000
    })

    expect(result).toEqual({inserted: 1, trimmed: 0, unread: 1})
    const newest = await db.posts.orderBy('publishedAt').reverse().first()
    expect(newest?.title).toBe('New RSS item 1')
    expect(newest?.status).toBe(false)
    expect((await db.feeds.get(feed.id))?.unreadCount).toBe(1)
  })

  it('parses the OPML fixture into folder paths and feeds', async () => {
    const response = await fetch(`${fixture.url}/opml.xml`)
    const xml = await response.text()
    const feeds = parseOpmlFeeds(xml)

    expect(feeds.map((feed) => feed.url)).toEqual([
      `${fixture.url}/rss.xml`,
      `${fixture.url}/atom.xml`,
      `${fixture.url}/feed.json`
    ])
    expect(feeds[0].folderPath).toEqual(['Tech', 'Nested'])
    expect(feeds[2].folderPath).toEqual([])
  })

  it('keeps parsed posts readable without the fixture server', async () => {
    const feed = feedFixture({url: `${fixture.url}/atom.xml`})
    await db.feeds.add(feed)
    const {parsed} = await loadFeed('/atom.xml')
    await ingestFeed(feed, parsed, {retention: 200, firstFetch: true, now: 1_000})

    const cached = await db.posts.orderBy('publishedAt').reverse().toArray()
    expect(cached.map((post) => post.title)).toEqual(['Atom Two', 'Atom One'])
    expect(cached.every((post) => post.contentHtml)).toBe(true)
  })
})
