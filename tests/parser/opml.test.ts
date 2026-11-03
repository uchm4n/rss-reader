import {describe, expect, it} from 'vitest'
import type {Feed, Folder} from '../../src/db/types'
import {generateOpml, parseOpmlFeeds} from '../../src/shared/parser/parse-opml'

const opml = `<?xml version="1.0"?>
<opml version="2.0">
  <head><title>Subscriptions</title></head>
  <body>
    <outline text="Tech">
      <outline text="Feed A" type="rss" xmlUrl="https://a.example.com/feed.xml"/>
      <outline text="Nested">
        <outline text="Feed B" type="rss" xmlUrl="https://b.example.com/rss"/>
      </outline>
    </outline>
    <outline text="Root Feed" type="rss" xmlUrl="https://c.example.com/feed.atom"/>
  </body>
</opml>`

const folders: Folder[] = [
  {id: 'folder-1', name: 'Tech', sortOrder: 0, createdAt: 1, updatedAt: 1}
]

const feeds: Feed[] = [
  {
    id: 'feed-1',
    url: 'https://a.example.com/feed.xml',
    siteUrl: 'https://a.example.com/',
    title: 'Feed A',
    description: null,
    favicon: null,
    folderId: 'folder-1',
    refreshInterval: null,
    lastFetchedAt: null,
    nextFetchAt: 0,
    etag: null,
    lastModified: null,
    errorCount: 0,
    lastError: null,
    unreadCount: 0,
    createdAt: 1,
    updatedAt: 1
  },
  {
    id: 'feed-2',
    url: 'https://c.example.com/feed.atom',
    siteUrl: 'https://c.example.com/',
    title: 'Root Feed',
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
    updatedAt: 1
  }
]

describe('parseOpmlFeeds', () => {
  it('flattens nested folders into folder paths', () => {
    expect(parseOpmlFeeds(opml)).toEqual([
      {
        url: 'https://a.example.com/feed.xml',
        title: 'Feed A',
        folderPath: ['Tech']
      },
      {
        url: 'https://b.example.com/rss',
        title: 'Feed B',
        folderPath: ['Tech', 'Nested']
      },
      {
        url: 'https://c.example.com/feed.atom',
        title: 'Root Feed',
        folderPath: []
      }
    ])
  })

  it('throws a clear error for malformed input', () => {
    expect(() => parseOpmlFeeds('<opml><body><outline')).toThrow(
      'Unrecognized OPML format'
    )
  })
})

describe('generateOpml', () => {
  it('exports folders, their feeds and root feeds', () => {
    const xml = generateOpml(folders, feeds)

    expect(xml).toContain('text="Tech"')
    expect(xml).toContain('xmlUrl="https://a.example.com/feed.xml"')
    expect(xml).toContain('xmlUrl="https://c.example.com/feed.atom"')

    expect(parseOpmlFeeds(xml)).toEqual(
      expect.arrayContaining([
        {
          url: 'https://a.example.com/feed.xml',
          title: 'Feed A',
          folderPath: ['Tech']
        },
        {
          url: 'https://c.example.com/feed.atom',
          title: 'Root Feed',
          folderPath: []
        }
      ])
    )
  })
})
