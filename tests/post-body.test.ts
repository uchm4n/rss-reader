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
})
