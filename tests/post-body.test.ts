// @vitest-environment jsdom
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, it} from 'vitest'
import {PostBody} from '@/popup/components/posts/post-body.tsx'

describe('PostBody', () => {
  it('renders plain text with preserved line breaks', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostBody, {content: 'First line.\nSecond line.'})
    )

    expect(html).toContain('whitespace-pre-wrap')
    expect(html).toContain('First line.\nSecond line.')
  })

  it('renders JSON through the code block enhancer', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostBody, {content: '{"a":1}'})
    )

    expect(html).toContain('language-json')
    expect(html).toContain('data-copy-code')
  })

  it('highlights matching plain text', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostBody, {
        content: 'Hello WordPress',
        matchWords: ['WordPress']
      })
    )

    expect(html).toContain('<mark class="match-highlight">WordPress</mark>')
  })

  it('highlights matching prose but not code', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostBody, {
        content: '<p>WordPress</p><pre><code>WordPress</code></pre>',
        contentType: 'html',
        matchWords: ['WordPress']
      })
    )
    const document = new DOMParser().parseFromString(html, 'text/html')

    expect(document.querySelectorAll('mark.match-highlight')).toHaveLength(1)
    expect(document.querySelector('pre mark')).toBeNull()
  })
})
