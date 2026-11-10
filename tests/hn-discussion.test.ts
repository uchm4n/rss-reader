// @vitest-environment jsdom
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, it} from 'vitest'
import {PostArticle} from '../src/popup/components/posts/post-reader'
import {HnThreadView} from '../src/popup/components/posts/hn-discussion'
import {parseHnThread, type HnThread} from '../src/popup/lib/hn-content'
import {feedFixture, postFixture} from './helpers/db'

const COMMENTS_LINK =
  '<a href="https://news.ycombinator.com/item?id=50406563">Comments</a>'

const STORY = {
  id: 50406563,
  type: 'story',
  title: 'The end of Microsoft Research AI Frontiers',
  author: 'srean',
  points: 294,
  created_at_i: 1794074537,
  url: 'https://hunch.net/?p=13764006',
  text: null,
  children: [
    {
      id: 50406862,
      author: 'bob',
      created_at_i: 1794074620,
      text: '<p>First comment</p>',
      children: [
        {
          id: 50406906,
          author: null,
          created_at_i: 1794074700,
          text: null,
          children: []
        }
      ]
    },
    {
      id: 50408007,
      author: 'carol',
      created_at_i: 1794075000,
      text: 'Second comment',
      children: []
    }
  ]
}

function thread(): HnThread {
  return parseHnThread(STORY) as HnThread
}

function renderThread(initialLimit?: number): string {
  return renderToStaticMarkup(
    React.createElement(HnThreadView, {thread: thread(), initialLimit})
  )
}

function renderArticle(contentHtml: string | null, link = 'https://example.com/post'): string {
  return renderToStaticMarkup(
    React.createElement(PostArticle, {
      post: postFixture({contentHtml, link}),
      feed: feedFixture(),
      onOpenOriginal: () => {}
    })
  )
}

describe('HnThreadView', () => {
  it('renders story metadata, comment links, and comments', () => {
    const html = renderThread()

    expect(html).toContain('aria-label="Hacker News discussion"')
    expect(html).toContain('294 points')
    expect(html).toContain('srean')
    expect(html).toContain('3 comments')
    expect(html).toContain('href="https://news.ycombinator.com/item?id=50406563"')
    expect(html).toContain('First comment')
    expect(html).toContain('Second comment')
    expect(html).toContain(
      'href="https://news.ycombinator.com/user?id=bob"'
    )
    expect(html).toContain(
      'href="https://news.ycombinator.com/item?id=50406862"'
    )
    expect(html).toContain('class="discussion-comment-author"')
  })

  it('offers a fold control only on comments with replies', () => {
    const html = renderThread()

    expect(html).toContain('aria-label="Collapse replies"')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('[-]')
    expect((html.match(/aria-label="Collapse replies"/g) ?? []).length).toBe(1)
  })

  it('omits the fold control for a leaf comment', () => {
    const leaf = parseHnThread({
      id: 1,
      children: [{id: 2, author: 'x', text: 'hi', children: []}]
    }) as HnThread

    const html = renderToStaticMarkup(
      React.createElement(HnThreadView, {thread: leaf})
    )

    expect(html).not.toContain('aria-label="Collapse replies"')
  })

  it('caps the visible comments and offers the rest', () => {
    const html = renderThread(2)

    expect(html).toContain('First comment')
    expect(html).not.toContain('Second comment')
    expect(html).toContain('Show 1 more comment')
    expect(html).toContain('[deleted]')
  })

  it('sanitizes hostile comment markup and safe-links anchors', () => {
    const hostile = parseHnThread({
      id: 1,
      children: [
        {
          id: 2,
          author: 'mallory',
          created_at_i: 1000,
          text: '<p>Safe</p><script>alert(1)</script><a href="https://example.com">link</a>',
          children: []
        }
      ]
    }) as HnThread

    const html = renderToStaticMarkup(
      React.createElement(HnThreadView, {thread: hostile})
    )

    expect(html).not.toContain('<script')
    expect(html).toContain('Safe')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer noopener"')
  })
})

describe('PostArticle HN integration', () => {
  it('replaces the lone Comments link with the discussion', () => {
    const html = renderArticle(COMMENTS_LINK)

    expect(html).toContain('aria-label="Hacker News discussion"')
    expect(html).toContain('Loading discussion')
    expect(html).not.toContain('>Comments</a>')
    expect(html).not.toContain('No content available')
    expect(html).not.toContain('Reddit discussion')
  })

  it('keeps non-HN post content unchanged', () => {
    const html = renderArticle('<p>Post body</p>')

    expect(html).toContain('Post body')
    expect(html).not.toContain('Hacker News discussion')
  })

  it('keeps extra HN content above the discussion', () => {
    const html = renderArticle(`<p>Summary</p>${COMMENTS_LINK}`)

    expect(html).toContain('Summary')
    expect(html).toContain('Hacker News discussion')
  })
})
