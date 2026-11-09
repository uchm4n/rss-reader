// @vitest-environment jsdom
import {describe, expect, it} from 'vitest'
import {highlightPostHtml} from '../../src/popup/lib/highlight'

describe('highlightPostHtml', () => {
  it('wraps matching text nodes in subtle marks', () => {
    const html = highlightPostHtml(
      '<p>Hello <strong>WordPress</strong></p>',
      ['wordpress']
    )

    expect(html).toContain('<mark class="match-highlight">WordPress</mark>')
  })

  it('does not highlight code, buttons or media cards', () => {
    const html = highlightPostHtml(
      '<p>WordPress</p><pre>WordPress</pre><button>WordPress</button><div class="media-card">WordPress</div>',
      ['WordPress']
    )
    const document = new DOMParser().parseFromString(html, 'text/html')

    expect(document.querySelectorAll('mark.match-highlight')).toHaveLength(1)
    expect(document.querySelector('pre mark')).toBeNull()
    expect(document.querySelector('button mark')).toBeNull()
    expect(document.querySelector('.media-card mark')).toBeNull()
  })

  it('preserves link attributes', () => {
    const html = highlightPostHtml(
      '<p><a href="https://example.com" target="_blank">WordPress</a></p>',
      ['WordPress']
    )
    const document = new DOMParser().parseFromString(html, 'text/html')
    const anchor = document.querySelector('a')

    expect(anchor?.getAttribute('href')).toBe('https://example.com')
    expect(anchor?.getAttribute('target')).toBe('_blank')
    expect(anchor?.querySelector('mark')?.textContent).toBe('WordPress')
  })

  it('leaves the html unchanged when there are no words', () => {
    const input = '<p>Hello WordPress</p>'
    expect(highlightPostHtml(input, [])).toBe(input)
  })
})
