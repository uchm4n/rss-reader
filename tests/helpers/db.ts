import {db} from '../../src/db/db'
import type {Feed, Post} from '../../src/db/types'
import type {ParsedFeed, ParsedPost} from '../../src/shared/parser/parse-feed'

export function feedFixture(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 'feed-1',
    url: 'https://example.com/feed.xml',
    siteUrl: 'https://example.com/',
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
    unreadCount: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

export async function seedFeed(overrides: Partial<Feed> = {}): Promise<Feed> {
  const feed = feedFixture(overrides)
  await db.feeds.add(feed)
  return feed
}

export function parsedPost(overrides: Partial<ParsedPost> = {}): ParsedPost {
  return {
    guid: 'post-1',
    title: 'Post',
    link: 'https://example.com/post-1',
    publishedAt: 100,
    contentHtml: '<p>Post body</p>',
    excerpt: 'Post body',
    imageUrl: null,
    author: null,
    ...overrides
  }
}

export function parsedFeed(items: ParsedPost[]): ParsedFeed {
  return {
    title: 'Feed',
    siteUrl: 'https://example.com/',
    description: null,
    imageUrl: null,
    items
  }
}

export function postFixture(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    feedId: 'feed-1',
    guid: 'post-1',
    title: 'Post',
    link: 'https://example.com/post-1',
    publishedAt: 100,
    fetchedAt: 100,
    excerpt: 'Post body',
    contentHtml: '<p>Post body</p>',
    imageUrl: null,
    author: null,
    status: false,
    starred: false,
    statusKey: 0,
    starredKey: 0,
    readAt: null,
    starredAt: null,
    searchText: 'post post body https://example.com/post-1',
    extractedHtml: null,
    extractionStatus: 'idle',
    imageCacheKeys: [],
    ...overrides
  }
}
