// @vitest-environment jsdom
import {describe, expect, it} from 'vitest'
import {renderPostContent} from '../../src/popup/lib/post-content'
import {
  parseRedditCard,
  redditPostId,
  renderRedditContent
} from '../../src/popup/lib/reddit-content'

function htmlOf(result: ReturnType<typeof renderPostContent>): string {
  if (result.kind === 'text') throw new Error('Expected rendered HTML')
  return result.html
}

const POST_URL =
  'https://www.reddit.com/r/WTF/comments/1wen3tq/an_actual_footage_from_slovenian_highway/'

const VIDEO_CARD = `<table> <tr><td> <a href="${POST_URL}"> <img src="https://external-preview.redd.it/Z3dmN3A1ajVlNXBoMSS6CPS5U25PRLt-oSQdFsMYNKitQUBQkOX0NHN2tN1F.png?width=320&amp;crop=smart&amp;auto=webp&amp;s=827fab9014288e830f829d3d900a1a111781bf34" alt="An actual footage from Slovenian highway" title="An actual footage from Slovenian highway" /> </a> </td><td> <!-- SC_OFF --><div class="md"><p>Even AI couldn&#39;t come up with this kind of wtfuckery </p> </div><!-- SC_ON --> &#32; submitted by &#32; <a href="https://www.reddit.com/user/cesam1ne"> /u/cesam1ne </a> <br/> <span><a href="https://v.redd.it/simn5xn5e5ph1">[link]</a></span> &#32; <span><a href="${POST_URL}">[comments]</a></span> </td></tr></table>`

function card(link: string, image = true): string {
  return `<table><tr><td><a href="${POST_URL}">${
    image ? '<img src="https://external-preview.redd.it/thumb.png">' : 'post'
  }</a></td><td><div class="md"><p>Summary text</p></div> submitted by <a href="https://www.reddit.com/user/foo">/u/foo</a> <br/><span><a href="${link}">[link]</a></span></td></tr></table>`
}

describe('redditPostId', () => {
  it('finds the post id from Reddit content anchors', () => {
    expect(
      redditPostId({link: 'https://example.com/story', contentHtml: VIDEO_CARD})
    ).toBe('1wen3tq')
  })

  it('falls back to the post link', () => {
    expect(redditPostId({link: POST_URL, contentHtml: null})).toBe('1wen3tq')
  })

  it('rejects lookalike hosts, comment permalinks and non-HTTPS URLs', () => {
    expect(
      redditPostId({
        link: 'https://reddit.com.evil.test/r/WTF/comments/1wen3tq/title/',
        contentHtml: null
      })
    ).toBeNull()
    expect(
      redditPostId({
        link: 'https://www.reddit.com/r/WTF/comments/1wen3tq/title/p9f26nb/',
        contentHtml: null
      })
    ).toBeNull()
    expect(
      redditPostId({
        link: 'http://www.reddit.com/r/WTF/comments/1wen3tq/title/',
        contentHtml: null
      })
    ).toBeNull()
  })
})

describe('parseRedditCard', () => {  it('parses a video card from the real RSS shape', () => {
    const parsed = parseRedditCard(VIDEO_CARD)

    expect(parsed).toMatchObject({
      kind: 'video',
      postId: '1wen3tq',
      postUrl: POST_URL,
      author: 'cesam1ne',
      outboundUrl: 'https://v.redd.it/simn5xn5e5ph1'
    })
    expect(parsed?.summaryHtml).toContain('Even AI couldn')
    expect(parsed?.thumbnailUrl).toContain('external-preview.redd.it')
  })

  it('parses an image card with the full image URL', () => {
    const parsed = parseRedditCard(
      card('https://i.redd.it/0rzrr18pykzh1.jpeg')
    )

    expect(parsed).toMatchObject({
      kind: 'image',
      imageUrl: 'https://i.redd.it/0rzrr18pykzh1.jpeg'
    })
  })

  it('parses a link card with the external destination', () => {
    const parsed = parseRedditCard(card('https://example.com/story'))

    expect(parsed).toMatchObject({
      kind: 'link',
      outboundUrl: 'https://example.com/story'
    })
  })

  it('parses a self post with only summary content', () => {
    const parsed = parseRedditCard(
      `<table><tr><td><a href="${POST_URL}">post</a></td><td><div class="md"><p>Self text</p></div> submitted by <a href="https://www.reddit.com/user/foo">/u/foo</a></td></tr></table>`
    )

    expect(parsed).toMatchObject({
      kind: 'self',
      outboundUrl: null
    })
    expect(parsed?.summaryHtml).toContain('Self text')
  })

  it('parses a gallery card', () => {
    const parsed = parseRedditCard(
      card('https://www.reddit.com/gallery/abc123')
    )

    expect(parsed).toMatchObject({
      kind: 'gallery',
      outboundUrl: 'https://www.reddit.com/gallery/abc123'
    })
  })

  it('rejects a comment permalink', () => {
    const parsed = parseRedditCard(
      `<table><tr><td><a href="https://www.reddit.com/r/WTF/comments/1wen3tq/slug/p9f26nb/">comment</a></td><td><div class="md"><p>Comment</p></div> submitted by <a href="https://www.reddit.com/user/foo">/u/foo</a></td></tr></table>`
    )

    expect(parsed).toBeNull()
  })

  it('rejects a non-Reddit table containing submitted by', () => {
    expect(
      parseRedditCard(
        '<table><tr><td>submitted by someone</td></tr></table>'
      )
    ).toBeNull()
  })

  it('uses the post thumbnail as a fallback when the card has no image', () => {
    const parsed = parseRedditCard(
      card('https://example.com/story', false),
      'https://example.com/thumb.png'
    )

    expect(parsed?.thumbnailUrl).toBe('https://example.com/thumb.png')
  })
})

describe('renderRedditContent', () => {
  it('renders a video card with the media-only player and no title', () => {
    const html = renderRedditContent(VIDEO_CARD)
    if (!html) throw new Error('Expected a Reddit card')

    expect(html).toContain('class="reddit-card"')
    expect(html).toContain(
      'src="https://www.reddit.com/mediaembed/1wen3tq"'
    )
    expect(html).toContain('class="reddit-video-poster"')
    expect(html).toContain('src="https://external-preview.redd.it/Z3dmN3A1')
    expect(html.indexOf('reddit-video-poster')).toBeLessThan(
      html.indexOf('<iframe')
    )
    expect(html).toContain('Even AI couldn')
    expect(html).toContain('u/cesam1ne')
    expect(html).toContain('View on Reddit')
    expect(html).not.toContain('<table')
    expect(html).not.toContain('submitted by')
    expect(html).not.toContain('redditmedia.com')
    expect(html).not.toContain('An actual footage from Slovenian highway')
  })

  it('uses a square fallback when a video card has no thumbnail', () => {
    const html = renderRedditContent(card('https://v.redd.it/abc123', false))

    expect(html).toContain('class="reddit-media reddit-media-square"')
    expect(html).not.toContain('reddit-video-poster')
    expect(html).toContain('<iframe')
  })

  it('renders an image card without an iframe', () => {
    const html = renderRedditContent(
      card('https://i.redd.it/0rzrr18pykzh1.jpeg')
    )

    expect(html).toContain('src="https://i.redd.it/0rzrr18pykzh1.jpeg"')
    expect(html).not.toContain('<iframe')
  })

  it('renders a link card with the destination and domain', () => {
    const html = renderRedditContent(card('https://example.com/story'))

    expect(html).toContain('href="https://example.com/story"')
    expect(html).toContain('example.com')
    expect(html).not.toContain('<iframe')
  })

  it('renders a self post without media', () => {
    const html = renderRedditContent(
      `<table><tr><td><a href="${POST_URL}">post</a></td><td><div class="md"><p>Self text</p></div> submitted by <a href="https://www.reddit.com/user/foo">/u/foo</a></td></tr></table>`
    )

    expect(html).toContain('Self text')
    expect(html).not.toContain('<iframe')
  })

  it('renders a gallery card with the gallery destination', () => {
    const html = renderRedditContent(
      card('https://www.reddit.com/gallery/abc123')
    )

    expect(html).toContain('href="https://www.reddit.com/gallery/abc123"')
    expect(html).toContain('src="https://external-preview.redd.it/thumb.png"')
    expect(html).not.toContain('<iframe')
  })

  it('uses the fallback thumbnail for a link card', () => {
    const html = renderRedditContent(
      card('https://example.com/story', false),
      'https://example.com/thumb.png'
    )

    expect(html).toContain('src="https://example.com/thumb.png"')
  })

  it('returns null for non-Reddit content', () => {
    expect(renderRedditContent('<p>Hello</p>')).toBeNull()
  })
})

describe('renderPostContent with Reddit cards', () => {
  it('renders one media-only iframe and no RSS card', () => {
    const container = document.createElement('div')
    container.innerHTML = htmlOf(renderPostContent(VIDEO_CARD, 'html'))

    expect(container.querySelectorAll('iframe')).toHaveLength(1)
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe(
      'https://www.reddit.com/mediaembed/1wen3tq'
    )
    expect(
      container.querySelector('.reddit-video-poster')?.getAttribute('src')
    ).toContain('external-preview.redd.it')
    expect(container.querySelector('table')).toBeNull()
    expect(container.textContent).not.toContain('submitted by')
    expect(container.textContent).toContain('Even AI couldn')
  })

  it('leaves non-Reddit tables alone', () => {
    const html = htmlOf(
      renderPostContent('<table><tr><td>1</td></tr></table>', 'html')
    )

    expect(html).toContain('<table>')
  })
})
