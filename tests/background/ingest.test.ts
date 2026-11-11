import {afterEach, describe, expect, it} from 'vitest'
import {ingestFeed} from '../../src/background/ingest'
import {db} from '../../src/db/db'
import {feedFixture, parsedFeed, parsedPost, seedFeed} from '../helpers/db'

afterEach(async () => {
  await db.delete()
  await db.open()
})

describe('ingestFeed', () => {
  it('imports the first fetch as read and stores unread count zero', async () => {
    const feed = await seedFeed()
    const parsed = parsedFeed([
      parsedPost({guid: 'g1', title: 'One', publishedAt: 100}),
      parsedPost({guid: 'g2', title: 'Two', publishedAt: 200})
    ])

    const result = await ingestFeed(feed, parsed, {
      retention: 50,
      firstFetch: true,
      now: 1_000
    })

    expect(result).toEqual({inserted: 2, trimmed: 0, unread: 0})

    const posts = await db.posts.orderBy('publishedAt').reverse().toArray()
    expect(posts.map((post) => post.id)).toEqual(['feed-1:g2', 'feed-1:g1'])
    expect(posts.every((post) => post.status)).toBe(true)
    expect(posts.every((post) => post.statusKey === 1)).toBe(true)
    expect(posts.every((post) => post.readAt === 1_000)).toBe(true)

    expect((await db.feeds.get('feed-1'))?.unreadCount).toBe(0)
  })

  it('stores the parsed content type', async () => {
    const feed = await seedFeed()
    const parsed = parsedFeed([
      parsedPost({guid: 'g1', contentType: 'markdown', contentHtml: '# Hello'})
    ])

    await ingestFeed(feed, parsed, {retention: 50, firstFetch: true, now: 1_000})

    expect((await db.posts.get('feed-1:g1'))?.contentType).toBe('markdown')
  })

  it('does not duplicate posts and preserves read and starred state', async () => {
    const feed = await seedFeed()
    const parsed = parsedFeed([
      parsedPost({guid: 'g1', title: 'One', publishedAt: 100}),
      parsedPost({guid: 'g2', title: 'Two', publishedAt: 200})
    ])

    await ingestFeed(feed, parsed, {retention: 50, firstFetch: true, now: 1_000})
    await db.posts.update('feed-1:g1', {
      status: false,
      statusKey: 0,
      starred: true,
      starredKey: 1,
      readAt: null,
      starredAt: 900
    })
    await db.feeds.update('feed-1', {unreadCount: 1})

    const result = await ingestFeed(
      feed,
      parsedFeed([
        parsedPost({guid: 'g1', title: 'One updated', publishedAt: 100}),
        parsedPost({guid: 'g2', title: 'Two', publishedAt: 200})
      ]),
      {retention: 50, firstFetch: false, now: 2_000}
    )

    expect(result).toEqual({inserted: 0, trimmed: 0, unread: 1})

    const posts = await db.posts.toArray()
    expect(posts).toHaveLength(2)

    const first = await db.posts.get('feed-1:g1')
    expect(first?.title).toBe('One updated')
    expect(first?.status).toBe(false)
    expect(first?.statusKey).toBe(0)
    expect(first?.starred).toBe(true)
    expect(first?.starredKey).toBe(1)
    expect(first?.starredAt).toBe(900)

    expect((await db.feeds.get('feed-1'))?.unreadCount).toBe(1)
  })

  it('dedupes posts without a guid by link', async () => {
    const feed = await seedFeed()
    const parsed = parsedFeed([
      parsedPost({guid: null, link: 'https://example.com/same', publishedAt: 100})
    ])

    await ingestFeed(feed, parsed, {retention: 50, firstFetch: true, now: 1_000})
    const result = await ingestFeed(
      feed,
      parsedFeed([
        parsedPost({
          guid: null,
          link: 'https://example.com/same',
          title: 'Changed',
          publishedAt: 100
        })
      ]),
      {retention: 50, firstFetch: false, now: 2_000}
    )

    expect(result.inserted).toBe(0)
    expect(await db.posts.count()).toBe(1)
  })

  it('keeps only the newest 50 posts on a large first fetch', async () => {
    const feed = await seedFeed()
    const items = Array.from({length: 201}, (_, index) =>
      parsedPost({
        guid: `g${index + 1}`,
        title: `Post ${index + 1}`,
        publishedAt: index + 1
      })
    )

    const result = await ingestFeed(feed, parsedFeed(items), {
      retention: 50,
      firstFetch: true,
      now: 1_000
    })

    expect(result).toEqual({inserted: 201, trimmed: 151, unread: 0})

    const posts = await db.posts.orderBy('publishedAt').toArray()
    expect(posts).toHaveLength(50)
    expect(posts[0].publishedAt).toBe(152)
    expect(posts.at(-1)?.publishedAt).toBe(201)
    expect(posts.every((post) => post.status)).toBe(true)
  })

  it('tracks watch-word matches on the feed', async () => {
    const feed = await seedFeed({matchWords: ['WordPress', 'AI']})
    const parsed = parsedFeed([
      parsedPost({guid: 'g1', title: 'WordPress news', publishedAt: 100, link: 'https://example.com/1'}),
      parsedPost({guid: 'g2', title: 'Other', publishedAt: 200, link: 'https://example.com/2'})
    ])

    await ingestFeed(feed, parsed, {
      retention: 50,
      firstFetch: true,
      now: 1_000
    })

    expect((await db.feeds.get('feed-1'))?.matchedWords).toEqual(['WordPress'])
  })

  it('updates watch-word matches when a later post matches', async () => {
    const feed = await seedFeed({matchWords: ['WordPress', 'AI']})

    await ingestFeed(
      feed,
      parsedFeed([parsedPost({guid: 'g1', title: 'WordPress news', publishedAt: 100, link: 'https://example.com/1'})]),
      {retention: 50, firstFetch: true, now: 1_000}
    )
    expect((await db.feeds.get('feed-1'))?.matchedWords).toEqual(['WordPress'])

    await ingestFeed(
      feed,
      parsedFeed([parsedPost({guid: 'g2', title: 'AI update', publishedAt: 200, link: 'https://example.com/2'})]),
      {retention: 50, firstFetch: false, now: 2_000}
    )
    expect((await db.feeds.get('feed-1'))?.matchedWords).toEqual(['WordPress', 'AI'])
  })

  it('clears a match when retention removes the matching post', async () => {
    const feed = await seedFeed({matchWords: ['WordPress']})

    await ingestFeed(
      feed,
      parsedFeed([
        parsedPost({guid: 'match', title: 'WordPress news', publishedAt: 100, link: 'https://example.com/match'}),
        parsedPost({guid: 'other', title: 'Other', publishedAt: 200, link: 'https://example.com/other'})
      ]),
      {retention: 50, firstFetch: true, now: 1_000}
    )
    expect((await db.feeds.get('feed-1'))?.matchedWords).toEqual(['WordPress'])

    await ingestFeed(
      feed,
      parsedFeed([parsedPost({guid: 'new', title: 'Newer', publishedAt: 300, link: 'https://example.com/new'})]),
      {retention: 1, firstFetch: false, now: 2_000}
    )

    expect((await db.feeds.get('feed-1'))?.matchedWords).toEqual([])
  })

  it('adds later items as unread at the top', async () => {
    const feed = await seedFeed()
    await ingestFeed(
      feed,
      parsedFeed([
        parsedPost({guid: 'g1', publishedAt: 100}),
        parsedPost({guid: 'g2', publishedAt: 200})
      ]),
      {retention: 50, firstFetch: true, now: 1_000}
    )

    const result = await ingestFeed(
      feed,
      parsedFeed([
        parsedPost({guid: 'g1', publishedAt: 100}),
        parsedPost({guid: 'g2', publishedAt: 200}),
        parsedPost({guid: 'g3', title: 'New', publishedAt: 300})
      ]),
      {retention: 50, firstFetch: false, now: 2_000}
    )

    expect(result).toEqual({inserted: 1, trimmed: 0, unread: 1})

    const posts = await db.posts.orderBy('publishedAt').reverse().toArray()
    expect(posts[0].id).toBe('feed-1:g3')
    expect(posts[0].status).toBe(false)
    expect(posts[0].statusKey).toBe(0)
    expect((await db.feeds.get('feed-1'))?.unreadCount).toBe(1)
  })

  it('keeps state when a feed changes an item GUID but keeps the link', async () => {
    const feed = await seedFeed()
    await ingestFeed(
      feed,
      parsedFeed([parsedPost({guid: 'g1', link: 'https://example.com/same', publishedAt: 100})]),
      {retention: 50, firstFetch: true, now: 1_000}
    )
    await db.posts.update('feed-1:g1', {
      status: false,
      statusKey: 0,
      starred: true,
      starredKey: 1,
      readAt: null,
      starredAt: 900
    })

    const result = await ingestFeed(
      feed,
      parsedFeed([parsedPost({guid: 'g2', link: 'https://example.com/same', publishedAt: 100})]),
      {retention: 50, firstFetch: false, now: 2_000}
    )

    expect(result.inserted).toBe(0)
    expect(await db.posts.count()).toBe(1)
    expect(await db.posts.get('feed-1:g1')).toMatchObject({
      guid: 'g2',
      link: 'https://example.com/same',
      status: false,
      starred: true,
      starredAt: 900
    })
  })

  it('keeps state when an item gains a GUID for the same link', async () => {
    const feed = await seedFeed()
    await ingestFeed(
      feed,
      parsedFeed([parsedPost({guid: null, link: 'https://example.com/same', publishedAt: 100})]),
      {retention: 50, firstFetch: true, now: 1_000}
    )

    const result = await ingestFeed(
      feed,
      parsedFeed([parsedPost({guid: 'g1', link: 'https://example.com/same', publishedAt: 100})]),
      {retention: 50, firstFetch: false, now: 2_000}
    )

    expect(result.inserted).toBe(0)
    expect(await db.posts.count()).toBe(1)
    expect((await db.posts.toArray())[0].status).toBe(true)
  })

  it('keeps an undated post stable across fetches', async () => {
    const feed = await seedFeed()
    const parsed = parsedFeed([
      parsedPost({guid: null, link: null, title: 'Undated', publishedAt: 0})
    ])

    await ingestFeed(feed, parsed, {retention: 50, firstFetch: true, now: 1_000})
    const first = await db.posts.toArray()
    expect(first[0]).toMatchObject({publishedAt: 1_000, fetchedAt: 1_000})

    await ingestFeed(feed, parsed, {retention: 50, firstFetch: false, now: 2_000})
    const second = await db.posts.toArray()
    expect(second).toHaveLength(1)
    expect(second[0]).toMatchObject({publishedAt: 1_000, fetchedAt: 1_000})
  })

  it('does nothing when the feed no longer exists', async () => {
    const feed = feedFixture({id: 'deleted-feed'})

    const result = await ingestFeed(
      feed,
      parsedFeed([parsedPost({guid: 'g1'})]),
      {retention: 50, firstFetch: false, now: 1_000}
    )

    expect(result).toEqual({inserted: 0, trimmed: 0, unread: 0})
    expect(await db.posts.count()).toBe(0)
  })

  it('trims old unread posts and adjusts the unread count', async () => {
    const feed = await seedFeed()
    const readPosts = Array.from({length: 50}, (_, index) =>
      parsedPost({guid: `read-${index}`, publishedAt: index + 1})
    )
    await ingestFeed(feed, parsedFeed(readPosts), {
      retention: 50,
      firstFetch: true,
      now: 1_000
    })

    const unreadPosts = Array.from({length: 5}, (_, index) =>
      parsedPost({guid: `new-${index}`, publishedAt: 1_000 + index})
    )
    const result = await ingestFeed(feed, parsedFeed(unreadPosts), {
      retention: 50,
      firstFetch: false,
      now: 2_000
    })

    expect(result).toEqual({inserted: 5, trimmed: 5, unread: 5})
    expect(await db.posts.count()).toBe(50)
    expect((await db.feeds.get('feed-1'))?.unreadCount).toBe(5)
    expect(await db.posts.where('statusKey').equals(0).count()).toBe(5)
  })
})
