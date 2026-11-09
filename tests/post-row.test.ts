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
})
