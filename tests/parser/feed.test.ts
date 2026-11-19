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

const redditListing = JSON.stringify({
  kind: 'Listing',
  data: {
    after: null,
    children: [
      {
        kind: 't3',
        data: {
          name: 't3_self1',
          id: 'self1',
          title: 'Self post',
          subreddit: 'news',
          subreddit_name_prefixed: 'r/news',
          permalink: '/r/news/comments/self1/self_post/',
          url: 'https://www.reddit.com/r/news/comments/self1/self_post/',
          selftext: 'Hello from Reddit',
          selftext_html: '<p>Hello from Reddit</p>',
          created_utc: 1760000000,
          author: 'alice',
          thumbnail: 'default',
          preview: {
            images: [
              {
                source: {
                  url: 'https://preview.redd.it/self.png?width=640&amp;format=png'
                }
              }
            ]
          },
          is_self: true,
          post_hint: 'self'
        }
      },
      {
        kind: 't3',
        data: {
          name: 't3_link1',
          id: 'link1',
          title: 'Link post',
          subreddit: 'news',
          subreddit_name_prefixed: 'r/news',
          permalink: '/r/news/comments/link1/link_post/',
          url: 'https://example.com/story?utm_source=reddit',
          url_overridden_by_dest: 'https://example.com/story?utm_source=reddit',
          selftext: 'Link caption',
          selftext_html: '<p>Link caption</p>',
          created_utc: 1760000060,
          author: 'bob',
          thumbnail: 'https://b.thumbs.redditmedia.com/link.jpg',
          is_self: false,
          post_hint: 'link'
        }
      },
      {kind: 'more', data: {count: 10, name: 't3_more'}},
      {
        kind: 't1',
        data: {
          name: 't1_comment',
          body: 'A comment, not a post'
        }
      }
    ]
  }
})

const mixedRedditListing = JSON.stringify({
  kind: 'Listing',
  data: {
    children: [
      {
        kind: 't3',
        data: {
          name: 't3_one',
          title: 'One',
          subreddit: 'news',
          permalink: '/r/news/comments/one/one/'
        }
      },
      {
        kind: 't3',
        data: {
          name: 't3_two',
          title: 'Two',
          subreddit: 'technology',
          permalink: '/r/technology/comments/two/two/'
        }
      }
    ]
  }
})

const redditMediaListing = JSON.stringify({
  kind: 'Listing',
  data: {
    children: [
      {
        kind: 't3',
        data: {
          name: 't3_video',
          title: 'Video post',
          subreddit: 'aww',
          permalink: '/r/aww/comments/video/video_post/',
          url: 'https://v.redd.it/abc',
          url_overridden_by_dest: 'https://v.redd.it/abc',
          selftext: 'Credit: @helvelle\\_et\\_sylve on TikTok ',
          selftext_html:
            '&lt;!-- SC_OFF --&gt;&lt;div class="md"&gt;&lt;p&gt;Credit: @helvelle_et_sylve on TikTok &lt;/p&gt;\n&lt;/div&gt;&lt;!-- SC_ON --&gt;',
          created_utc: 1760000100,
          author: 'carol',
          post_hint: 'hosted:video',
          is_video: true,
          secure_media: {
            reddit_video: {
              fallback_url: 'https://v.redd.it/abc/CMAF_720.mp4?source=fallback'
            }
          },
          preview: {
            images: [
              {
                source: {
                  url: 'https://external-preview.redd.it/video.png?format=pjpg&amp;auto=webp&amp;s=1'
                }
              }
            ]
          },
          thumbnail: 'https://external-preview.redd.it/video-thumb.png'
        }
      },
      {
        kind: 't3',
        data: {
          name: 't3_image',
          title: 'Image post',
          subreddit: 'aww',
          permalink: '/r/aww/comments/image/image_post/',
          url: 'https://i.redd.it/image.jpeg',
          url_overridden_by_dest: 'https://i.redd.it/image.jpeg',
          selftext: '',
          selftext_html: null,
          created_utc: 1760000200,
          author: 'dana',
          post_hint: 'image',
          is_video: false,
          preview: {
            images: [
              {
                source: {
                  url: 'https://preview.redd.it/image.jpeg?width=1080&amp;format=jpg&amp;s=2'
                }
              }
            ]
          },
          thumbnail: 'https://preview.redd.it/image-thumb.jpeg'
        }
      },
      {
        kind: 't3',
        data: {
          name: 't3_gallery',
          title: 'Gallery post',
          subreddit: 'aww',
          permalink: '/r/aww/comments/gallery/gallery_post/',
          url: 'https://www.reddit.com/gallery/gallery',
          url_overridden_by_dest: 'https://www.reddit.com/gallery/gallery',
          selftext: '',
          selftext_html: null,
          created_utc: 1760000300,
          author: 'erin',
          is_gallery: true,
          thumbnail: 'https://preview.redd.it/gallery-thumb.jpeg',
          media_metadata: {
            a: {
              status: 'valid',
              m: 'image/jpeg',
              s: {
                u: 'https://preview.redd.it/a.jpeg?width=4032&amp;format=pjpg&amp;s=3'
              },
              p: [
                {
                  u: 'https://preview.redd.it/a.jpeg?width=1080&amp;crop=smart&amp;auto=webp&amp;s=4'
                }
              ]
            },
            b: {
              status: 'valid',
              m: 'image/jpeg',
              p: [
                {
                  u: 'https://preview.redd.it/b.jpeg?width=1080&amp;auto=webp&amp;s=5'
                }
              ]
            }
          }
        }
      }
    ]
  }
})

const redditEscapedSelftext = JSON.stringify({
  kind: 'Listing',
  data: {
    children: [
      {
        kind: 't3',
        data: {
          name: 't3_escaped',
          title: 'Escaped selftext',
          subreddit: 'test',
          permalink: '/r/test/comments/escaped/escaped_selftext/',
          url: 'https://www.reddit.com/r/test/comments/escaped/escaped_selftext/',
          selftext: 'Line one & two',
          selftext_html:
            '&lt;!-- SC_OFF --&gt;&lt;div class="md"&gt;&lt;p&gt;Line one &amp; two&lt;/p&gt;&lt;/div&gt;&lt;!-- SC_ON --&gt;',
          created_utc: 1760000400,
          author: 'frank',
          is_self: true
        }
      }
    ]
  }
})

const redditCrosspostVideo = JSON.stringify({
  kind: 'Listing',
  data: {
    children: [
      {
        kind: 't3',
        data: {
          name: 't3_cross',
          title: 'Crosspost video',
          subreddit: 'crosspost',
          permalink: '/r/crosspost/comments/cross/crosspost_video/',
          url: 'https://www.reddit.com/r/original/comments/orig/original_video/',
          url_overridden_by_dest:
            'https://www.reddit.com/r/original/comments/orig/original_video/',
          selftext: '',
          selftext_html: null,
          created_utc: 1760000500,
          author: 'gina',
          is_video: false,
          post_hint: 'link',
          crosspost_parent_list: [
            {
              is_video: true,
              post_hint: 'hosted:video',
              secure_media: {
                reddit_video: {
                  fallback_url:
                    'https://v.redd.it/cross/CMAF_720.mp4?source=fallback'
                }
              },
              preview: {
                images: [
                  {
                    source: {
                      url: 'https://external-preview.redd.it/cross.png?format=pjpg&amp;auto=webp&amp;s=1'
                    }
                  }
                ]
              },
              thumbnail:
                'https://external-preview.redd.it/cross-thumb.png'
            }
          ]
        }
      }
    ]
  }
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
      contentType: 'html',
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
      contentType: 'html',
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
      contentType: 'html',
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
      contentType: 'html',
      excerpt: 'RDF body'
    })
  })

  it('preserves an Atom markdown content type', () => {
    const feed = parseFeedDocument(`<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Markdown</title>
  <entry>
    <id>tag:example.com,2026:md</id>
    <title>Markdown entry</title>
    <content type="text/markdown"># Hello</content>
  </entry>
</feed>`)

    expect(feed.items[0]).toMatchObject({
      contentHtml: '# Hello',
      contentType: 'markdown'
    })
  })

  it('marks JSON Feed content_text as text', () => {
    const feed = parseFeedDocument(
      JSON.stringify({
        version: 'https://jsonfeed.org/version/1.1',
        title: 'Text JSON',
        items: [{id: 'text-1', content_text: 'Hello\nworld'}]
      })
    )

    expect(feed.items[0]).toMatchObject({
      contentHtml: 'Hello\nworld',
      contentType: 'text'
    })
  })

  it('normalizes a Reddit JSON listing', () => {
    const feed = parseFeedDocument(redditListing)

    expect(feed.title).toBe('r/news')
    expect(feed.siteUrl).toBe('https://www.reddit.com/r/news/')
    expect(feed.items).toHaveLength(2)
    expect(feed.items[0]).toMatchObject({
      guid: 't3_self1',
      title: 'Self post',
      link: 'https://www.reddit.com/r/news/comments/self1/self_post/',
      publishedAt: 1760000000000,
      contentHtml: '<p>Hello from Reddit</p>',
      contentType: 'html',
      excerpt: 'Hello from Reddit',
      imageUrl: 'https://preview.redd.it/self.png?width=640&format=png',
      author: 'alice'
    })
    expect(feed.items[1]).toMatchObject({
      guid: 't3_link1',
      title: 'Link post',
      link: 'https://www.reddit.com/r/news/comments/link1/link_post/',
      publishedAt: 1760000060000,
      contentType: 'html',
      excerpt: 'Link caption',
      imageUrl: 'https://b.thumbs.redditmedia.com/link.jpg',
      author: 'bob'
    })
    expect(feed.items[1].contentHtml).toContain(
      '<p><a href="https://example.com/story?utm_source=reddit">https://example.com/story?utm_source=reddit</a></p>'
    )
    expect(feed.items[1].contentHtml).toContain('<p>Link caption</p>')
  })

  it('uses Reddit as the title for mixed-subreddit listings', () => {
    const feed = parseFeedDocument(mixedRedditListing)

    expect(feed).toMatchObject({
      title: 'Reddit',
      siteUrl: 'https://www.reddit.com/'
    })
  })

  it('normalizes Reddit video media into content', () => {
    const feed = parseFeedDocument(redditMediaListing)
    const video = feed.items[0]

    expect(video).toMatchObject({
      guid: 't3_video',
      title: 'Video post',
      link: 'https://www.reddit.com/r/aww/comments/video/video_post/',
      contentType: 'html',
      imageUrl:
        'https://external-preview.redd.it/video.png?format=pjpg&auto=webp&s=1',
      excerpt: 'Credit: @helvelle_et_sylve on TikTok'
    })
    expect(video.contentHtml).toContain(
      'https://v.redd.it/abc/CMAF_720.mp4?source=fallback'
    )
    expect(video.contentHtml).toContain(
      '<p>Credit: @helvelle_et_sylve on TikTok </p>'
    )
    expect(video.contentHtml).not.toContain('SC_OFF')
    expect(video.contentHtml).not.toContain('&lt;')
  })

  it('normalizes Reddit image media into content', () => {
    const feed = parseFeedDocument(redditMediaListing)
    const image = feed.items[1]

    expect(image).toMatchObject({
      guid: 't3_image',
      title: 'Image post',
      contentType: 'html',
      imageUrl:
        'https://preview.redd.it/image.jpeg?width=1080&format=jpg&s=2'
    })
    expect(image.contentHtml).toContain(
      'https://preview.redd.it/image.jpeg?width=1080&amp;format=jpg&amp;s=2'
    )
  })

  it('normalizes Reddit gallery media into content', () => {
    const feed = parseFeedDocument(redditMediaListing)
    const gallery = feed.items[2]

    expect(gallery).toMatchObject({
      guid: 't3_gallery',
      title: 'Gallery post',
      contentType: 'html',
      imageUrl: 'https://preview.redd.it/gallery-thumb.jpeg'
    })
    expect(gallery.contentHtml).toContain(
      'https://preview.redd.it/a.jpeg?width=4032&amp;format=pjpg&amp;s=3'
    )
    expect(gallery.contentHtml).toContain(
      'https://preview.redd.it/b.jpeg?width=1080&amp;auto=webp&amp;s=5'
    )
  })

  it('decodes Reddit selftext HTML', () => {
    const post = parseFeedDocument(redditEscapedSelftext).items[0]

    expect(post).toMatchObject({
      contentType: 'html',
      excerpt: 'Line one & two'
    })
    expect(post.contentHtml).toContain('<p>Line one & two</p>')
    expect(post.contentHtml).not.toContain('SC_OFF')
    expect(post.contentHtml).not.toContain('&lt;')
  })

  it('uses crosspost parent video media', () => {
    const post = parseFeedDocument(redditCrosspostVideo).items[0]

    expect(post).toMatchObject({
      contentType: 'html',
      imageUrl:
        'https://external-preview.redd.it/cross.png?format=pjpg&auto=webp&s=1',
      excerpt: ''
    })
    expect(post.contentHtml).toContain(
      'https://v.redd.it/cross/CMAF_720.mp4?source=fallback'
    )
  })

  it('throws a clear error for malformed input', () => {
    expect(() => parseFeedDocument('<rss><channel></rss>')).toThrow(
      'Unrecognized feed format'
    )
    expect(() => parseFeedDocument('not a feed')).toThrow('Unrecognized feed format')
    expect(() =>
      parseFeedDocument(JSON.stringify({kind: 'Thing', data: {children: []}}))
    ).toThrow('Unrecognized feed format')
  })

  it('falls back to zero for a missing date', () => {
    const feed = parseFeedDocument(
      '<rss version="2.0"><channel><title>No date</title><link>https://example.com/</link><description>d</description><item><title>Undated</title><link>https://example.com/u</link><description>u</description></item></channel></rss>'
    )

    expect(feed.items[0].publishedAt).toBe(0)
  })
})
