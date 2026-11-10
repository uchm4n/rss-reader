// @vitest-environment jsdom
import {describe, expect, it} from 'vitest'
import {
  detectContentKind,
  renderPostContent,
  type RenderedPostContent
} from '@/popup/lib/post-content.ts'

function htmlOf(result: RenderedPostContent): string {
  if (result.kind === 'text') throw new Error('Expected rendered HTML')
  return result.html
}

describe('detectContentKind', () => {
  it('detects a JSON object', () => {
    expect(detectContentKind('{"title":"Hello","items":[1,2]}')).toBe('json')
  })

  it('detects a JSON array', () => {
    expect(detectContentKind('[{"id":1},{"id":2}]')).toBe('json')
  })

  it('detects HTML', () => {
    expect(detectContentKind('<p>Hello <strong>world</strong></p>')).toBe('html')
  })

  it('detects markdown blocks', () => {
    expect(detectContentKind('# Heading\n\n- one\n- two')).toBe('markdown')
  })

  it('detects inline markdown', () => {
    expect(detectContentKind('A **bold** move and `code`.')).toBe('markdown')
  })

  it('keeps ordinary text as text', () => {
    expect(detectContentKind('Just a line.\nAnd another.')).toBe('text')
  })

  it('does not mistake a less-than sign for HTML', () => {
    expect(detectContentKind('2 < 3 and 4 > 1')).toBe('text')
  })

  it('uses the declared markdown type even without markers', () => {
    expect(detectContentKind('Just prose', 'markdown')).toBe('markdown')
  })

  it('treats declared text with tags as text', () => {
    expect(detectContentKind('<p>Not markup</p>', 'text')).toBe('text')
  })

  it('treats declared HTML without tags as text', () => {
    expect(detectContentKind('Just a line.\nAnd another.', 'html')).toBe('text')
  })

  it('still detects JSON when the declared type is text', () => {
    expect(detectContentKind('{"a":1}', 'text')).toBe('json')
  })
})

describe('renderPostContent', () => {
  it('sanitizes HTML and keeps safe markup', () => {
    const result = renderPostContent(
      '<p>Hello</p><script>alert(1)</script><style>body{display:none}</style>',
      'html'
    )

    expect(result.kind).toBe('html')
    expect(htmlOf(result)).toContain('<p>Hello</p>')
    expect(htmlOf(result)).not.toContain('<script')
    expect(htmlOf(result)).not.toContain('<style')
  })

  it('formats JSON as a copyable code block', () => {
    const result = renderPostContent('{"b":2,"a":1}')

    expect(result.kind).toBe('json')
    expect(htmlOf(result)).toContain('language-json')
    expect(htmlOf(result)).toContain('"b": 2')
    expect(htmlOf(result)).toContain('class="code-block"')
    expect(htmlOf(result)).toContain('data-copy-code')
    expect(htmlOf(result)).toContain('JSON')
  })

  it('renders markdown headings, quotes and fenced code', () => {
    const result = renderPostContent(
      '# Title\n\n> Quote\n\n```js\nconst x = 1\n```',
      'markdown'
    )

    expect(result.kind).toBe('markdown')
    expect(htmlOf(result)).toContain('<h1>Title</h1>')
    expect(htmlOf(result)).toContain('<blockquote>')
    expect(htmlOf(result)).toContain('language-js')
    expect(htmlOf(result)).toContain('class="code-block"')
  })

  it('preserves plain text line breaks instead of injecting it as HTML', () => {
    const result = renderPostContent('First line.\nSecond line.')

    expect(result).toEqual({kind: 'text', text: 'First line.\nSecond line.'})
  })

  it('decodes HTML entities in plain text', () => {
    const result = renderPostContent('Hello &amp; welcome — 2 &lt; 3')

    expect(result).toEqual({kind: 'text', text: 'Hello & welcome — 2 < 3'})
  })

  it('keeps entities literal in a declared plain-text body', () => {
    const result = renderPostContent('Hello &amp; welcome', 'text')

    expect(result).toEqual({kind: 'text', text: 'Hello &amp; welcome'})
  })

  it('wraps tables in a horizontal scroll container', () => {
    const result = renderPostContent(
      '<table><tbody><tr><td>1</td></tr></tbody></table>',
      'html'
    )

    expect(htmlOf(result)).toContain('class="table-scroll"')
  })

  it('adds a language label to code blocks', () => {
    const result = renderPostContent(
      '<pre><code class="language-ts">const x = 1</code></pre>',
      'html'
    )

    expect(htmlOf(result)).toContain('class="code-block-language">TS')
  })

  it('lazy-loads images and keeps external links safe', () => {
    const result = renderPostContent(
      '<img src="https://example.com/x.png" alt="x"><a href="https://example.com">x</a>',
      'html'
    )

    expect(htmlOf(result)).toContain('loading="lazy"')
    expect(htmlOf(result)).toContain('target="_blank"')
    expect(htmlOf(result)).toContain('rel="noreferrer noopener"')
  })

  it('adds controls and metadata preload to videos without autoplay', () => {
    const result = renderPostContent(
      '<video autoplay src="https://example.com/video.mp4"></video>',
      'html'
    )

    expect(htmlOf(result)).toContain('controls')
    expect(htmlOf(result)).toContain('playsinline')
    expect(htmlOf(result)).toContain('preload="metadata"')
    expect(htmlOf(result)).not.toContain('autoplay')
  })

  it('adds controls to audio without autoplay', () => {
    const result = renderPostContent(
      '<audio autoplay src="https://example.com/audio.mp3"></audio>',
      'html'
    )

    expect(htmlOf(result)).toContain('controls')
    expect(htmlOf(result)).toContain('preload="metadata"')
    expect(htmlOf(result)).not.toContain('autoplay')
  })

  it('preserves image aspect ratio without fixed dimensions', () => {
    const result = renderPostContent(
      '<img src="https://example.com/tall.png" width="400" height="1200">',
      'html'
    )

    expect(htmlOf(result)).toContain('aspect-ratio: 400 / 1200')
    expect(htmlOf(result)).not.toContain('width="400"')
    expect(htmlOf(result)).not.toContain('height="1200"')
  })

  it('replaces a link-only paragraph with a safe embed', () => {
    const result = renderPostContent(
      '<p><a href="https://www.reddit.com/r/WTF/comments/1wen3tq/an_actual_footage_from_slovenian_highway/">Watch</a></p>',
      'html'
    )

    expect(htmlOf(result)).toContain(
      'src="https://www.redditmedia.com/r/WTF/comments/1wen3tq/an_actual_footage_from_slovenian_highway/?ref_source=embed'
    )
    expect(htmlOf(result)).toContain('sandbox="allow-scripts')
    expect(htmlOf(result)).not.toContain('<p>')
    expect(htmlOf(result)).not.toContain('>Watch<')
  })

  it('keeps surrounding text when appending an embed', () => {
    const result = renderPostContent(
      '<p>Watch this: <a href="https://www.reddit.com/r/WTF/comments/1wen3tq/post/">link</a></p>',
      'html'
    )

    expect(htmlOf(result)).toContain('Watch this:')
    expect(htmlOf(result)).toContain('<iframe')
  })

  it('renders direct video links as players', () => {
    const result = renderPostContent(
      '<p><a href="https://packaged-media.redd.it/abc/DASH_720.mp4">video</a></p>',
      'html'
    )

    expect(htmlOf(result)).toContain('<video')
    expect(htmlOf(result)).toContain(
      'src="https://packaged-media.redd.it/abc/DASH_720.mp4"'
    )
    expect(htmlOf(result)).toContain('controls')
  })

  it('replaces a Reddit-style media-card table with the embed', () => {
    const result = renderPostContent(
      '<table><tbody><tr><td><a href="https://www.reddit.com/r/WTF/comments/1wen3tq/post/">Watch</a></td></tr></tbody></table>',
      'html'
    )
    const container = document.createElement('div')
    container.innerHTML = htmlOf(result)

    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('.table-scroll')).toBeNull()
    expect(container.querySelector('iframe')?.getAttribute('src')).toContain(
      'redditmedia.com'
    )
    expect(container.textContent).not.toContain('Watch')
  })

  it('replaces a media-card table even when it contains summary text', () => {
    const result = renderPostContent(
      '<table><tbody><tr><td><a href="https://www.reddit.com/r/WTF/comments/1wen3tq/post/"><img src="https://example.com/thumb.png"></a></td><td><div>Post title</div><p>Summary text</p><a href="https://v.redd.it/abc">[link]</a></td></tr></tbody></table>',
      'html'
    )
    const container = document.createElement('div')
    container.innerHTML = htmlOf(result)

    expect(container.querySelector('table')).toBeNull()
    expect(container.textContent).not.toContain('Summary text')
    expect(container.querySelector('iframe')?.getAttribute('src')).toContain(
      'redditmedia.com'
    )
  })

  it('prefers a direct video link over an embed in the same block', () => {
    const result = renderPostContent(
      '<p><a href="https://www.reddit.com/r/WTF/comments/1wen3tq/post/">post</a> <a href="https://packaged-media.redd.it/abc/DASH_720.mp4">video</a></p>',
      'html'
    )

    expect(htmlOf(result)).toContain('<video')
    expect(htmlOf(result)).not.toContain('<iframe')
  })

  it('keeps picture sources and lazy-loads the nested image', () => {
    const result = renderPostContent(
      '<picture><source srcset="https://example.com/a.webp"><img src="https://example.com/a.jpg"></picture>',
      'html'
    )

    expect(htmlOf(result)).toContain('<picture>')
    expect(htmlOf(result)).toContain('srcset="https://example.com/a.webp"')
    expect(htmlOf(result)).toContain('loading="lazy"')
  })

  it('renders YouTube links as preview cards instead of erroring iframes', () => {
    const result = renderPostContent(
      '<p>Watch: <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">this video</a></p>',
      'html'
    )
    const html = htmlOf(result)

    expect(html).toContain('class="media-card"')
    expect(html).toContain(
      'href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"'
    )
    expect(html).toContain(
      'src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"'
    )
    expect(html).toContain('Watch:')
    expect(html).not.toContain('<iframe')
  })

  it('replaces a YouTube iframe with a preview card', () => {
    const result = renderPostContent(
      '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
      'html'
    )
    const html = htmlOf(result)

    expect(html).toContain('class="media-card"')
    expect(html).not.toContain('<iframe')
  })

  it('keeps non-YouTube provider embeds as iframes', () => {
    const result = renderPostContent(
      '<p><a href="https://vimeo.com/123456789">Watch</a></p>',
      'html'
    )
    const html = htmlOf(result)

    expect(html).toContain('<iframe')
    expect(html).toContain('player.vimeo.com/video/123456789')
    expect(html).not.toContain('media-card')
  })

  it('deduplicates a YouTube link and iframe for the same video', () => {
    const result = renderPostContent(
      '<p><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Watch</a></p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
      'html'
    )
    const container = document.createElement('div')
    container.innerHTML = htmlOf(result)

    expect(container.querySelectorAll('.media-card')).toHaveLength(1)
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('renders a YouTube link inside a Reddit summary as a card', () => {
    const result = renderPostContent(
      '<table><tr><td><a href="https://www.reddit.com/r/WTF/comments/1wen3tq/post/">post</a></td><td><div class="md"><p>Summary <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">video</a></p></div> submitted by <a href="https://www.reddit.com/user/foo">/u/foo</a></td></tr></table>',
      'html'
    )
    const container = document.createElement('div')
    container.innerHTML = htmlOf(result)

    expect(container.querySelector('.reddit-card')).not.toBeNull()
    expect(container.querySelector('.reddit-summary .media-card')).not.toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('renders a Giphy page link as a linked GIF image', () => {
    const result = renderPostContent(
      '<p><a href="https://giphy.com/gifs/y95xaEzMuyHAc">gif</a></p>',
      'html'
    )
    const container = document.createElement('div')
    container.innerHTML = htmlOf(result)
    const link = container.querySelector('a.media-image-link')
    const image = container.querySelector('img.media-image')

    expect(link?.getAttribute('href')).toBe(
      'https://giphy.com/gifs/y95xaEzMuyHAc'
    )
    expect(image?.getAttribute('src')).toBe(
      'https://media.giphy.com/media/y95xaEzMuyHAc/giphy.gif'
    )
    expect(image?.getAttribute('loading')).toBe('lazy')
    expect(image?.getAttribute('decoding')).toBe('async')
    expect(image?.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(container.querySelector('p')).toBeNull()
  })

  it('extracts the GIF id from a Giphy slug URL', () => {
    const result = renderPostContent(
      '<p><a href="https://giphy.com/gifs/a-slug-y95xaEzMuyHAc">gif</a></p>',
      'html'
    )
    const container = document.createElement('div')
    container.innerHTML = htmlOf(result)

    expect(container.querySelector('img.media-image')?.getAttribute('src')).toBe(
      'https://media.giphy.com/media/y95xaEzMuyHAc/giphy.gif'
    )
  })

  it('renders direct image links as images', () => {
    for (const url of [
      'https://example.com/cat.gif',
      'https://example.com/cat.png',
      'https://example.com/cat.jpg',
      'https://example.com/cat.webp'
    ]) {
      const result = renderPostContent(
        `<p><a href="${url}">image</a></p>`,
        'html'
      )
      const container = document.createElement('div')
      container.innerHTML = htmlOf(result)

      expect(container.querySelector('img.media-image')?.getAttribute('src')).toBe(url)
    }
  })

  it('keeps prose and appends the image after the block', () => {
    const result = renderPostContent(
      '<p>Look <a href="https://giphy.com/gifs/y95xaEzMuyHAc">this</a> now</p>',
      'html'
    )
    const container = document.createElement('div')
    container.innerHTML = htmlOf(result)

    expect(container.querySelector('p')?.textContent).toContain('Look this now')
    expect(container.querySelector('img.media-image')).not.toBeNull()
    expect(container.querySelectorAll('img.media-image')).toHaveLength(1)
  })

  it('does not duplicate the same image link', () => {
    const result = renderPostContent(
      '<p><a href="https://giphy.com/gifs/y95xaEzMuyHAc">one</a></p><p><a href="https://giphy.com/gifs/y95xaEzMuyHAc">two</a></p>',
      'html'
    )
    const container = document.createElement('div')
    container.innerHTML = htmlOf(result)

    expect(container.querySelectorAll('img.media-image')).toHaveLength(1)
  })

  it('rejects insecure, lookalike, invalid Giphy and SVG image links', () => {
    for (const url of [
      'http://giphy.com/gifs/y95xaEzMuyHAc',
      'https://giphy.com.evil.test/gifs/y95xaEzMuyHAc',
      'https://giphy.com/gifs/',
      'https://example.com/cat.svg'
    ]) {
      const result = renderPostContent(
        `<p><a href="${url}">image</a></p>`,
        'html'
      )
      const container = document.createElement('div')
      container.innerHTML = htmlOf(result)

      expect(container.querySelector('img.media-image')).toBeNull()
    }
  })

  it('does not insert image previews inside the Reddit card', () => {
    const result = renderPostContent(
      '<table><tr><td><a href="https://www.reddit.com/r/WTF/comments/1wen3tq/post/">post</a></td><td><div class="md"><p>Summary <a href="https://giphy.com/gifs/y95xaEzMuyHAc">gif</a></p></div> submitted by <a href="https://www.reddit.com/user/foo">/u/foo</a></td></tr></table>',
      'html'
    )
    const container = document.createElement('div')
    container.innerHTML = htmlOf(result)

    expect(container.querySelector('.reddit-card')).not.toBeNull()
    expect(container.querySelector('.reddit-card img.media-image')).toBeNull()
  })
})
