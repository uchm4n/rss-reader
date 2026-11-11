import {afterEach, describe, expect, it} from 'vitest'
import {
  countStarredPosts,
  markPostsRead,
  trimAllFeeds,
  trimFeedPosts,
  setPostStatus,
  togglePostStar
} from '../../src/db/posts'
import {db} from '../../src/db/db'
import {postFixture, seedFeed} from '../helpers/db'

afterEach(async () => {
  await db.delete()
  await db.open()
})

describe('post actions', () => {
  it('marks a post read and unread and keeps the feed count in sync', async () => {
    await seedFeed({unreadCount: 2})
    await db.posts.bulkAdd([
      postFixture({id: 'p1', guid: 'p1', publishedAt: 100}),
      postFixture({id: 'p2', guid: 'p2', publishedAt: 200})
    ])

    await setPostStatus('p1', true, 500)
    expect(await db.posts.get('p1')).toMatchObject({
      status: true,
      statusKey: 1,
      readAt: 500
    })
    expect((await db.feeds.get('feed-1'))?.unreadCount).toBe(1)

    await setPostStatus('p1', false, 600)
    expect(await db.posts.get('p1')).toMatchObject({
      status: false,
      statusKey: 0,
      readAt: null
    })
    expect((await db.feeds.get('feed-1'))?.unreadCount).toBe(2)
  })

  it('marks a batch as read and recomputes affected feed counts', async () => {
    await seedFeed({id: 'feed-1', unreadCount: 2})
    await seedFeed({
      id: 'feed-2',
      url: 'https://example.com/two.xml',
      unreadCount: 2
    })
    await db.posts.bulkAdd([
      postFixture({id: 'p1', feedId: 'feed-1', publishedAt: 100}),
      postFixture({id: 'p2', feedId: 'feed-1', publishedAt: 200}),
      postFixture({
        id: 'p3',
        feedId: 'feed-1',
        publishedAt: 300,
        status: true,
        statusKey: 1,
        readAt: 1
      }),
      postFixture({id: 'p4', feedId: 'feed-2', publishedAt: 400})
    ])

    await markPostsRead(['p1', 'p2'], 500)

    expect(await db.posts.get('p1')).toMatchObject({
      status: true,
      statusKey: 1,
      readAt: 500
    })
    expect(await db.posts.get('p2')).toMatchObject({
      status: true,
      statusKey: 1,
      readAt: 500
    })
    expect(await db.posts.get('p3')).toMatchObject({readAt: 1})
    expect((await db.feeds.get('feed-1'))?.unreadCount).toBe(0)
    expect((await db.feeds.get('feed-2'))?.unreadCount).toBe(2)
  })

  it('does nothing for an empty batch', async () => {
    await seedFeed({unreadCount: 1})
    await db.posts.add(postFixture({id: 'p1'}))

    await markPostsRead([])

    expect(await db.posts.get('p1')).toMatchObject({status: false})
    expect((await db.feeds.get('feed-1'))?.unreadCount).toBe(1)
  })

  it('toggles the star without changing read state', async () => {
    await seedFeed({unreadCount: 1})
    await db.posts.add(postFixture({id: 'p1'}))

    await togglePostStar('p1', 500)
    expect(await db.posts.get('p1')).toMatchObject({
      starred: true,
      starredKey: 1,
      starredAt: 500,
      status: false
    })

    await togglePostStar('p1', 600)
    expect(await db.posts.get('p1')).toMatchObject({
      starred: false,
      starredKey: 0,
      starredAt: null
    })
    expect((await db.feeds.get('feed-1'))?.unreadCount).toBe(1)
  })

  it('recomputes matched words when the matching post is trimmed', async () => {
    await seedFeed({matchWords: ['WordPress'], matchedWords: ['WordPress']})
    await db.posts.bulkAdd([
      postFixture({id: 'match', guid: 'match', title: 'WordPress news', publishedAt: 100}),
      postFixture({id: 'other', guid: 'other', title: 'Other', publishedAt: 200})
    ])

    await trimFeedPosts('feed-1', 1)

    expect((await db.feeds.get('feed-1'))?.matchedWords).toEqual([])
  })

  it('counts starred posts without changing unread counts', async () => {
    await seedFeed({unreadCount: 2})
    await db.posts.bulkAdd([
      postFixture({
        id: 'starred-1',
        guid: 'starred-1',
        starred: true,
        starredKey: 1,
        starredAt: 1
      }),
      postFixture({
        id: 'starred-2',
        guid: 'starred-2',
        starred: true,
        starredKey: 1,
        starredAt: 2
      }),
      postFixture({id: 'unstarred', guid: 'unstarred'})
    ])

    expect(await countStarredPosts()).toBe(2)
    expect((await db.feeds.get('feed-1'))?.unreadCount).toBe(2)
  })

  it('trims the oldest posts and recomputes unread count', async () => {
    await seedFeed({unreadCount: 2})
    await db.posts.bulkAdd([
      postFixture({id: 'old', guid: 'old', publishedAt: 100}),
      postFixture({id: 'middle', guid: 'middle', publishedAt: 200}),
      postFixture({
        id: 'new',
        guid: 'new',
        publishedAt: 300,
        status: true,
        statusKey: 1,
        readAt: 1
      })
    ])

    const result = await trimFeedPosts('feed-1', 2)

    expect(result).toEqual({trimmed: 1, unread: 1})
    expect(await db.posts.get('old')).toBeUndefined()
    expect(await db.posts.count()).toBe(2)
    expect((await db.feeds.get('feed-1'))?.unreadCount).toBe(1)
  })

  it('trims all feeds using each feed post limit', async () => {
    await seedFeed({id: 'feed-1'})
    await seedFeed({
      id: 'feed-2',
      url: 'https://example.com/two.xml',
      retentionPerFeed: 3
    })
    await db.posts.bulkAdd([
      postFixture({id: 'a1', feedId: 'feed-1', publishedAt: 100}),
      postFixture({id: 'a2', feedId: 'feed-1', publishedAt: 200}),
      postFixture({id: 'b1', feedId: 'feed-2', publishedAt: 100}),
      postFixture({id: 'b2', feedId: 'feed-2', publishedAt: 200}),
      postFixture({id: 'b3', feedId: 'feed-2', publishedAt: 300}),
      postFixture({id: 'b4', feedId: 'feed-2', publishedAt: 400})
    ])

    await trimAllFeeds(1)

    expect(await db.posts.where('feedId').equals('feed-1').count()).toBe(1)
    expect(await db.posts.where('feedId').equals('feed-2').count()).toBe(3)
  })
})
