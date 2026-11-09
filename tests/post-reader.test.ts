import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, it} from 'vitest'
import {PostArticle, ReaderHeader} from '../src/popup/components/posts/post-reader'
import {feedFixture, postFixture} from './helpers/db'

function render(status: boolean): string {
  return renderToStaticMarkup(
    React.createElement(ReaderHeader, {
      post: postFixture({status, statusKey: status ? 1 : 0}),
      feed: feedFixture(),
      onBack: () => {},
      onOpenOriginal: () => {},
      onToggleStar: () => {},
      onMarkUnread: () => {},
      onPin: () => {}
    })
  )
}

describe('ReaderHeader', () => {
  it('always offers mark unread with an unread chat icon', () => {
    for (const status of [false, true]) {
      const html = render(status)
      expect(html).toContain('aria-label="Mark unread"')
      expect(html).not.toContain('aria-label="Mark read"')
      expect(html).toContain('lucide-message-square-dot size-4')
      expect(html).not.toContain('lucide-mail-open')
    }
  })

  it('offers a pin action before the star', () => {
    const html = render(false)
    expect(html).toContain('aria-label="Open pinned post"')
    expect(html.indexOf('aria-label="Open pinned post"')).toBeLessThan(
      html.indexOf('aria-label="Star post"')
    )
  })

  it('renders icon-only actions', () => {
    const html = render(false)
    expect(html).not.toContain('>Mark read<')
    expect(html).not.toContain('>Mark unread<')
    expect(html).not.toContain('>Open original<')
    expect(html).toContain('aria-label="Open original"')
  })
})

describe('PostArticle', () => {
  it('does not highlight the empty-content placeholder', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostArticle, {
        post: postFixture({title: 'Post', excerpt: '', contentHtml: null}),
        feed: feedFixture({matchWords: ['content']}),
        onOpenOriginal: () => {}
      })
    )

    expect(html).toContain('No content available for this post.')
    expect(html).not.toContain('<mark')
  })
})
