import {describe, expect, it} from 'vitest'
import {parseFeedDocument} from '../../src/shared/parser/parse-feed'

const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Example RSS</title>
    <link>https://example.com/</link>
    <description>RSS description</description>
    <image><url>https://example.com/rss.png</url><title>Example</title><link>https://example.com/</link></image>
    <item>
      <title>First post</title>
      <link>https://example.com/1</link>
      <guid>guid-1</guid>
      <pubDate>Tue, 03 Nov 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[<p>Hello &amp; welcome</p>]]></description>
      <content:encoded><![CDATA[<p>Full <b>content</b></p>]]></content:encoded>
      <author>Jane</author>
    </item>
  </channel>
</rss>`

const atom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom</title>
  <link href="https://example.com/"/>
  <subtitle>Atom subtitle</subtitle>
  <icon>https://example.com/atom.png</icon>
  <entry>
    <id>tag:example.com,2026:1</id>
    <title>Atom entry</title>
    <link href="https://example.com/a1"/>
    <published>2026-11-03T10:00:00Z</published>
    <updated>2026-11-03T10:00:00Z</updated>
    <content type="html">&lt;p&gt;Atom body&lt;/p&gt;</content>
    <summary>Atom summary</summary>
    <author><name>Ann</name></author>
  </entry>
</feed>`

const jsonFeed = JSON.stringify({
  version: 'https://jsonfeed.org/version/1.1',
  title: 'Example JSON',
  home_page_url: 'https://example.com/',
  description: 'JSON description',
  icon: 'https://example.com/json.png',
  items: [
    {
      id: 'json-1',
      url: 'https://example.com/j1',
      title: 'JSON item',
      content_html: '<p>JSON body</p>',
      summary: 'JSON summary',
      date_published: '2026-11-03T10:00:00Z',
      authors: [{name: 'Jo'}]
    }
  ]
})

const rdf = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns="http://purl.org/rss/1.0/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://example.com/">
    <title>Example RDF</title>
    <link>https://example.com/</link>
    <description>RDF description</description>
  </channel>
  <item rdf:about="https://example.com/r1">
    <title>RDF item</title>
    <link>https://example.com/r1</link>
    <description>RDF body</description>
    <dc:date>2026-11-03T10:00:00Z</dc:date>
  </item>
</rdf:RDF>`

const published = Date.parse('2026-11-03T10:00:00Z')

describe('parseFeedDocument', () => {
  it('normalizes an RSS 2.0 feed', () => {
    const feed = parseFeedDocument(rss)

    expect(feed.title).toBe('Example RSS')
    expect(feed.siteUrl).toBe('https://example.com/')
    expect(feed.description).toBe('RSS description')
    expect(feed.imageUrl).toBe('https://example.com/rss.png')
    expect(feed.items).toHaveLength(1)
    expect(feed.items[0]).toMatchObject({
      guid: 'guid-1',
      title: 'First post',
      link: 'https://example.com/1',
      publishedAt: published,
      contentHtml: '<p>Full <b>content</b></p>',
      excerpt: 'Hello & welcome',
      author: 'Jane'
    })
  })

  it('normalizes an Atom 1.0 feed', () => {
    const feed = parseFeedDocument(atom)

    expect(feed.title).toBe('Example Atom')
    expect(feed.siteUrl).toBe('https://example.com/')
    expect(feed.description).toBe('Atom subtitle')
    expect(feed.imageUrl).toBe('https://example.com/atom.png')
    expect(feed.items[0]).toMatchObject({
      guid: 'tag:example.com,2026:1',
      title: 'Atom entry',
      link: 'https://example.com/a1',
      publishedAt: published,
      contentHtml: '<p>Atom body</p>',
      excerpt: 'Atom summary',
      author: 'Ann'
    })
  })

  it('normalizes a JSON Feed', () => {
    const feed = parseFeedDocument(jsonFeed)

    expect(feed.title).toBe('Example JSON')
    expect(feed.siteUrl).toBe('https://example.com/')
    expect(feed.description).toBe('JSON description')
    expect(feed.imageUrl).toBe('https://example.com/json.png')
    expect(feed.items[0]).toMatchObject({
      guid: 'json-1',
      title: 'JSON item',
      link: 'https://example.com/j1',
      publishedAt: published,
      contentHtml: '<p>JSON body</p>',
      excerpt: 'JSON summary',
      author: 'Jo'
    })
  })

  it('normalizes an RDF feed', () => {
    const feed = parseFeedDocument(rdf)

    expect(feed.title).toBe('Example RDF')
    expect(feed.siteUrl).toBe('https://example.com/')
    expect(feed.description).toBe('RDF description')
    expect(feed.items[0]).toMatchObject({
      title: 'RDF item',
      link: 'https://example.com/r1',
      publishedAt: published,
      contentHtml: 'RDF body',
      excerpt: 'RDF body'
    })
  })

  it('throws a clear error for malformed input', () => {
    expect(() => parseFeedDocument('<rss><channel></rss>')).toThrow(
      'Unrecognized feed format'
    )
    expect(() => parseFeedDocument('not a feed')).toThrow('Unrecognized feed format')
  })

  it('falls back to zero for a missing date', () => {
    const feed = parseFeedDocument(
      '<rss version="2.0"><channel><title>No date</title><link>https://example.com/</link><description>d</description><item><title>Undated</title><link>https://example.com/u</link><description>u</description></item></channel></rss>'
    )

    expect(feed.items[0].publishedAt).toBe(0)
  })
})
