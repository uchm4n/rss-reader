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
})
