import http from 'node:http'
import {pathToFileURL} from 'node:url'

function xmlEscape(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function rssDocument(items) {
  return `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Fixture RSS</title>
    <link>http://127.0.0.1/</link>
    <description>Fixture RSS feed</description>
    ${items
      .map(
        (item) => `<item>
      <title>${xmlEscape(item.title)}</title>
      <link>${xmlEscape(item.link)}</link>
      <guid>${xmlEscape(item.guid)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description><![CDATA[<p>${xmlEscape(item.title)} body</p>]]></description>
      <content:encoded><![CDATA[<p>Full ${xmlEscape(item.title)} body</p>]]></content:encoded>
    </item>`
      )
      .join('\n')}
  </channel>
</rss>`
}

function atomDocument(items) {
  return `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Fixture Atom</title>
  <link href="http://127.0.0.1/"/>
  <subtitle>Fixture Atom feed</subtitle>
  ${items
    .map(
      (item) => `<entry>
    <id>${xmlEscape(item.guid)}</id>
    <title>${xmlEscape(item.title)}</title>
    <link href="${xmlEscape(item.link)}"/>
    <published>${new Date(item.publishedAt).toISOString()}</published>
    <updated>${new Date(item.publishedAt).toISOString()}</updated>
    <content type="html">&lt;p&gt;${xmlEscape(item.title)} body&lt;/p&gt;</content>
  </entry>`
    )
    .join('\n')}
</feed>`
}

function jsonDocument(items) {
  return JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Fixture JSON',
    home_page_url: 'http://127.0.0.1/',
    description: 'Fixture JSON feed',
    items: items.map((item) => ({
      id: item.guid,
      url: item.link,
      title: item.title,
      content_html: `<p>${xmlEscape(item.title)} body</p>`,
      date_published: new Date(item.publishedAt).toISOString()
    }))
  })
}

function opmlDocument(baseUrl) {
  return `<?xml version="1.0"?>
<opml version="2.0">
  <head><title>Fixture subscriptions</title></head>
  <body>
    <outline text="Tech">
      <outline text="Nested">
        <outline text="Fixture RSS" type="rss" xmlUrl="${baseUrl}/rss.xml"/>
        <outline text="Fixture Atom" type="rss" xmlUrl="${baseUrl}/atom.xml"/>
      </outline>
    </outline>
    <outline text="Fixture JSON" type="rss" xmlUrl="${baseUrl}/feed.json"/>
  </body>
</opml>`
}

function send(response, status, contentType, body) {
  response.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store'
  })
  response.end(body)
}

export async function startFixtureServer(port = 0) {
  let added = 0
  const base = () => `http://127.0.0.1:${server.address().port}`
  const rssItems = [
    {
      guid: 'rss-1',
      title: 'RSS One',
      link: 'http://127.0.0.1/rss/1',
      pubDate: 'Sat, 03 Jan 2026 08:00:00 GMT',
      publishedAt: Date.parse('2026-01-03T08:00:00Z')
    },
    {
      guid: 'rss-2',
      title: 'RSS Two',
      link: 'http://127.0.0.1/rss/2',
      pubDate: 'Sat, 03 Jan 2026 09:00:00 GMT',
      publishedAt: Date.parse('2026-01-03T09:00:00Z')
    },
    {
      guid: 'rss-3',
      title: 'RSS Three',
      link: 'http://127.0.0.1/rss/3',
      pubDate: 'Sat, 03 Jan 2026 10:00:00 GMT',
      publishedAt: Date.parse('2026-01-03T10:00:00Z')
    }
  ]
  const atomItems = [
    {
      guid: 'atom-1',
      title: 'Atom One',
      link: 'http://127.0.0.1/atom/1',
      publishedAt: Date.parse('2026-01-03T08:30:00Z')
    },
    {
      guid: 'atom-2',
      title: 'Atom Two',
      link: 'http://127.0.0.1/atom/2',
      publishedAt: Date.parse('2026-01-03T09:30:00Z')
    }
  ]
  const jsonItems = [
    {
      guid: 'json-1',
      title: 'JSON One',
      link: 'http://127.0.0.1/json/1',
      publishedAt: Date.parse('2026-01-03T08:15:00Z')
    },
    {
      guid: 'json-2',
      title: 'JSON Two',
      link: 'http://127.0.0.1/json/2',
      publishedAt: Date.parse('2026-01-03T09:15:00Z')
    }
  ]
  const retentionItems = Array.from({length: 201}, (_, index) => ({
    guid: `ret-${index}`,
    title: `Retention ${index}`,
    link: `http://127.0.0.1/retention/${index}`,
    pubDate: new Date(Date.parse('2026-01-01T00:00:00Z') + index * 60_000).toUTCString(),
    publishedAt: Date.parse('2026-01-01T00:00:00Z') + index * 60_000
  }))

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', base())

    switch (url.pathname) {
      case '/rss.xml':
        send(response, 200, 'application/rss+xml', rssDocument(rssItems))
        return
      case '/atom.xml':
        send(response, 200, 'application/atom+xml', atomDocument(atomItems))
        return
      case '/feed.json':
        send(response, 200, 'application/feed+json', jsonDocument(jsonItems))
        return
      case '/retention.xml':
        send(response, 200, 'application/rss+xml', rssDocument(retentionItems))
        return
      case '/opml.xml':
        send(response, 200, 'text/xml', opmlDocument(base()))
        return
      case '/add-item': {
        added += 1
        const now = Date.now()
        rssItems.push({
          guid: `rss-new-${added}`,
          title: `New RSS item ${added}`,
          link: `http://127.0.0.1/rss/new-${added}`,
          pubDate: new Date(now).toUTCString(),
          publishedAt: now
        })
        send(response, 200, 'application/json', JSON.stringify({added}))
        return
      }
      case '/':
        send(response, 200, 'text/plain', 'RSS Reader fixtures')
        return
      default:
        send(response, 404, 'text/plain', 'Not found')
    }
  })

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))

  return {
    server,
    port: server.address().port,
    url: base(),
    close: () => new Promise((resolve) => server.close(resolve))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = await startFixtureServer(Number(process.env.PORT ?? 0))
  console.log(`RSS Reader fixtures at ${fixture.url}`)
}
