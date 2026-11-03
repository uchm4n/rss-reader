import {afterEach, describe, expect, it} from 'vitest'
import {trimFeedPosts, setPostStatus, togglePostStar} from '../../src/db/posts'
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
})
