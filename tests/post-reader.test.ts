import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, it} from 'vitest'
import {ReaderHeader} from '../src/popup/components/posts/post-reader'
import {feedFixture, postFixture} from './helpers/db'

function render(status: boolean): string {
  return renderToStaticMarkup(
    React.createElement(ReaderHeader, {
      post: postFixture({status, statusKey: status ? 1 : 0}),
      feed: feedFixture(),
      onBack: () => {},
      onOpenOriginal: () => {},
      onToggleStar: () => {},
      onMarkRead: () => {},
      onMarkUnread: () => {},
      onPin: () => {}
    })
  )
}

describe('ReaderHeader', () => {
  it('offers mark read for an unread post', () => {
    const html = render(false)
    expect(html).toContain('Mark read')
    expect(html).not.toContain('Mark unread')
  })

  it('offers mark unread for a read post', () => {
    const html = render(true)
    expect(html).toContain('Mark unread')
    expect(html).not.toContain('Mark read')
  })

  it('offers a pin action before the star', () => {
    const html = render(false)
    expect(html).toContain('aria-label="Open pinned post"')
    expect(html.indexOf('aria-label="Open pinned post"')).toBeLessThan(
      html.indexOf('aria-label="Star post"')
    )
  })
})
