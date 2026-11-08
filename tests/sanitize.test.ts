// @vitest-environment jsdom
import {describe, expect, it} from 'vitest'
import {sanitizePostHtml} from '../src/popup/lib/sanitize'

describe('sanitizePostHtml', () => {
  it('removes scripts and event handlers', () => {
    const html = sanitizePostHtml(
      '<p>Hi</p><script>alert(1)</script><img src="x" onerror="alert(1)">'
    )
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
  })

  it('forces external links to open safely', () => {
    const html = sanitizePostHtml('<a href="https://example.com">x</a>')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer noopener"')
  })

  // The sanitizer keeps the normalized iframe; enhancePostHtml replaces YouTube with a card.
  it('keeps allowlisted iframe embeds with safe attributes', () => {
    const html = sanitizePostHtml(
      '<iframe src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" width="560" height="315"></iframe>'
    )

    expect(html).toContain(
      'src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"'
    )
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"')
    expect(html).toContain('sandbox="allow-scripts allow-same-origin')
    expect(html).toContain('allowfullscreen')
    expect(html).toContain('aspect-ratio: 1.7778')
    expect(html).toContain('title="YouTube video"')
  })

  it('uses the provider ratio for vertical social embeds', () => {
    const html = sanitizePostHtml(
      '<iframe src="https://www.tiktok.com/@scout2015/video/6718335390845095173" width="560" height="315"></iframe>'
    )

    expect(html).toContain(
      'src="https://www.tiktok.com/player/v1/6718335390845095173"'
    )
    expect(html).toContain('aspect-ratio: 0.5625')
  })

  it('keeps the Reddit media player without autoplay', () => {
    const html = sanitizePostHtml(
      '<iframe src="https://www.reddit.com/mediaembed/1wen3tq"></iframe>'
    )

    expect(html).toContain('src="https://www.reddit.com/mediaembed/1wen3tq"')
    expect(html).toContain('sandbox="allow-scripts allow-same-origin')
    expect(html).not.toContain('autoplay')
  })

  it('removes iframes from unknown hosts', () => {
    const html = sanitizePostHtml(
      '<iframe src="https://evil.example/embed/x"></iframe>'
    )

    expect(html).not.toContain('<iframe')
  })

  it('removes srcdoc iframes', () => {
    const html = sanitizePostHtml(
      '<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>'
    )

    expect(html).not.toContain('<iframe')
  })

  it('removes document-level tags that can change the popup', () => {
    const html = sanitizePostHtml(
      '<p>Hi</p><style>body{display:none}</style><link rel="stylesheet" href="x"><meta http-equiv="refresh" content="0"><base href="https://evil.example/">'
    )
    expect(html).not.toContain('<style')
    expect(html).not.toContain('<link')
    expect(html).not.toContain('<meta')
    expect(html).not.toContain('<base')
  })
})
