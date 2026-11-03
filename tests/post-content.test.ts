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
})
