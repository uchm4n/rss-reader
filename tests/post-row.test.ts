import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {JSDOM} from 'jsdom'
import {describe, expect, it} from 'vitest'
import {PostRow} from '../src/popup/components/posts/post-row'
import {feedFixture, postFixture} from './helpers/db'

describe('PostRow', () => {
  it('keeps the open control and star button as siblings', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostRow, {
        post: postFixture(),
        feed: feedFixture(),
        onOpen: () => {},
        onToggleStar: () => {}
      })
    )
    const document = new JSDOM(html).window.document

    expect(document.querySelector('button button')).toBeNull()
    expect(document.querySelectorAll('button')).toHaveLength(2)
  })

  it('clamps long text inside the row and keeps the star outside it', () => {
    const title = 'A'.repeat(160)
    const excerpt = 'B'.repeat(160)
    const html = renderToStaticMarkup(
      React.createElement(PostRow, {
        post: postFixture({title, excerpt}),
        feed: feedFixture(),
        onOpen: () => {},
        onToggleStar: () => {}
      })
    )
    const document = new JSDOM(html).window.document
    const titleNode = [...document.querySelectorAll('span')].find(
      (node) => node.textContent === title
    )
    const excerptNode = [...document.querySelectorAll('span')].find(
      (node) => node.textContent === excerpt
    )

    expect(titleNode?.className).toContain('line-clamp-2')
    expect(titleNode?.className).toContain('wrap-break-word')
    expect(excerptNode?.className).toContain('line-clamp-2')
    expect(excerptNode?.className).toContain('wrap-break-word')
    expect(titleNode?.parentElement?.className).toContain('overflow-hidden')

    const star = document.querySelector('button[aria-label="Star post"]')
    expect(star?.className).toContain('shrink-0')
  })

  it('highlights matching words in the title and excerpt', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostRow, {
        post: postFixture({title: 'WordPress news', excerpt: 'WordPress body'}),
        feed: feedFixture({matchWords: ['WordPress']}),
        onOpen: () => {},
        onToggleStar: () => {}
      })
    )
    const document = new JSDOM(html).window.document

    expect(document.querySelectorAll('mark.match-highlight')).toHaveLength(2)
    expect(document.querySelector('mark.match-highlight')?.textContent).toBe(
      'WordPress'
    )
  })

  it('clusters the unread dot with a yellow match dot', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostRow, {
        post: postFixture({title: 'WordPress news'}),
        feed: feedFixture({matchWords: ['WordPress']}),
        onOpen: () => {},
        onToggleStar: () => {}
      })
    )
    const document = new JSDOM(html).window.document
    const match = document.querySelector('[data-slot="post-match-dot"]')

    expect(document.querySelector('[data-slot="post-unread-dot"]')).not.toBeNull()
    expect(match).not.toBeNull()
    expect(match?.getAttribute('title')).toBe('Matched: WordPress')
    expect(match?.getAttribute('aria-label')).toBe('Matched: WordPress')
  })

  it('keeps the yellow dot after the post is read', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostRow, {
        post: postFixture({
          title: 'WordPress news',
          status: true,
          statusKey: 1,
          readAt: 1
        }),
        feed: feedFixture({matchWords: ['WordPress']}),
        onOpen: () => {},
        onToggleStar: () => {}
      })
    )
    const document = new JSDOM(html).window.document

    expect(document.querySelector('[data-slot="post-unread-dot"]')).toBeNull()
    expect(document.querySelector('[data-slot="post-match-dot"]')).not.toBeNull()
  })

  it('shows only the unread dot when the post does not match', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostRow, {
        post: postFixture({title: 'Other news', excerpt: 'Other body'}),
        feed: feedFixture({matchWords: ['WordPress']}),
        onOpen: () => {},
        onToggleStar: () => {}
      })
    )
    const document = new JSDOM(html).window.document

    expect(document.querySelector('[data-slot="post-unread-dot"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="post-match-dot"]')).toBeNull()
  })

  it('keeps the dot slot when a read post has no match', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostRow, {
        post: postFixture({
          title: 'Other news',
          excerpt: 'Other body',
          status: true,
          statusKey: 1,
          readAt: 1
        }),
        feed: feedFixture({matchWords: ['WordPress']}),
        onOpen: () => {},
        onToggleStar: () => {}
      })
    )
    const document = new JSDOM(html).window.document

    expect(document.querySelector('[data-slot="post-dot-slot"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="post-unread-dot"]')).toBeNull()
    expect(document.querySelector('[data-slot="post-match-dot"]')).toBeNull()
  })
})
