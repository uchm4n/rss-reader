import Dexie from 'dexie'
import {afterEach, describe, expect, it} from 'vitest'
import {db} from '../../src/db/db'

afterEach(async () => {
  await db.delete()
  await db.open()
})

describe('rss-reader schema', () => {
  it('stores and queries a post by feed and published date', async () => {
    await db.feeds.add({
      id: 'f1',
      url: 'https://example.com/feed.xml',
      siteUrl: null,
      title: 'Feed',
      description: null,
      favicon: null,
      folderId: null,
      refreshInterval: null,
      lastFetchedAt: null,
      nextFetchAt: 0,
      etag: null,
      lastModified: null,
      errorCount: 0,
      lastError: null,
      unreadCount: 1,
      createdAt: 1,
      updatedAt: 1
    })
    await db.posts.add({
      id: 'f1:p1',
      feedId: 'f1',
      guid: 'p1',
      title: 'Post',
      link: null,
      publishedAt: 10,
      fetchedAt: 10,
      excerpt: '',
      contentHtml: null,
      imageUrl: null,
      author: null,
      status: false,
      starred: false,
      statusKey: 0,
      starredKey: 0,
      readAt: null,
      starredAt: null,
      searchText: 'post',
      extractedHtml: null,
      extractionStatus: 'idle',
      imageCacheKeys: []
    })

    const posts = await db.posts
      .where('[feedId+publishedAt]')
      .between(['f1', Dexie.minKey], ['f1', Dexie.maxKey])
      .toArray()

    expect(posts.map((post) => post.id)).toEqual(['f1:p1'])
  })
})
