// @vitest-environment jsdom
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {JSDOM} from 'jsdom'
import {describe, expect, it} from 'vitest'
import {PostArticle} from '../src/popup/components/posts/post-reader'
import {RedditThreadView} from '../src/popup/components/posts/reddit-discussion'
import type {RedditThread} from '../src/popup/lib/reddit-comments'
import {feedFixture, postFixture} from './helpers/db'

const THREAD: RedditThread = {
  postId: 'abc123',
  postUrl: 'https://www.reddit.com/r/test/comments/abc123/title/',
  totalComments: 42,
  hasMore: true,
  comments: [
    {
      id: 'c1',
      author: 'alice',
      bodyHtml: '<p>Hello</p><img src="https://example.com/image.png" alt="">',
      score: 5,
      createdAt: 1700000000000,
      permalink: 'https://www.reddit.com/r/test/comments/abc123/title/c1/',
      children: [
        {
          id: 'c2',
          author: null,
          bodyHtml: null,
          score: null,
          createdAt: 0,
          permalink: null,
          children: []
        }
      ]
    },
    {
      id: 'c3',
      author: 'bob',
      bodyHtml: '<p>Second</p>',
      score: 2,
      createdAt: 1700001000000,
      permalink: 'https://www.reddit.com/r/test/comments/abc123/title/c3/',
      children: []
    }
  ]
}

const REDDIT_CARD = `<table><tr><td><a href="https://www.reddit.com/r/test/comments/abc123/title/"><img src="https://i.redd.it/x.jpg"></a></td><td><div class="md"><p>Post body</p></div> submitted by <a href="https://www.reddit.com/user/foo">/u/foo</a></td></tr></table>`

function renderView(overrides: Partial<React.ComponentProps<typeof RedditThreadView>> = {}): string {
  return renderToStaticMarkup(
    React.createElement(RedditThreadView, {
      thread: THREAD,
      loadedLimit: 200,
      refreshing: false,
      refreshError: false,
      onLoadMore: () => {},
      ...overrides
    })
  )
}

function renderArticle(contentHtml: string | null, link: string | null = null): string {
  return renderToStaticMarkup(
    React.createElement(PostArticle, {
      post: postFixture({contentHtml, link}),
      feed: feedFixture(),
      onOpenOriginal: () => {}
    })
  )
}

describe('RedditThreadView', () => {
  it('renders the header, comments and shared fold controls', () => {
    const html = renderView()
    const document = new JSDOM(html).window.document

    expect(html).toContain('aria-label="Reddit discussion"')
    expect(html).toContain('3 of 42 comments')
    expect(html).toContain('u/alice')
    expect(html).toContain('5 points')
    expect(html).toContain(
      'href="https://www.reddit.com/r/test/comments/abc123/title/c1/"'
    )
    expect(html).toContain('class="discussion-comment-author"')
    expect(html).toContain('aria-label="Collapse replies"')
    expect(
      document.querySelectorAll('button[aria-label="Collapse replies"]')
    ).toHaveLength(1)
    expect(html).toContain('[deleted]')
    expect(html).toContain('https://example.com/image.png')
    expect(html).not.toContain('More comments on Reddit')
  })

  it('shows Load more at 200 and Refresh at the 500 ceiling', () => {
    expect(renderView({loadedLimit: 200})).toContain('Load more')
    expect(renderView({loadedLimit: 500})).toContain('Refresh')
  })

  it('disables the button while refreshing and reports refresh errors', () => {
    const refreshing = new JSDOM(renderView({refreshing: true})).window.document
    const button = [...refreshing.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === 'Load more'
    )

    expect(button?.disabled).toBe(true)
    expect(renderView({loadedLimit: 200, refreshError: true})).toContain(
      'Couldn’t load more comments.'
    )
    expect(renderView({loadedLimit: 500, refreshError: true})).toContain(
      'Couldn’t refresh comments.'
    )
  })
})

describe('PostArticle Reddit integration', () => {
  it('renders the Reddit card and lazy discussion below it', () => {
    const html = renderArticle(REDDIT_CARD)

    expect(html).toContain('reddit-card')
    expect(html).toContain('aria-label="Reddit discussion"')
    expect(html).toContain('Loading discussion')
    expect(html).not.toContain('Hacker News discussion')
  })

  it('keeps non-Reddit posts unchanged', () => {
    const html = renderArticle('<p>Post body</p>')

    expect(html).toContain('Post body')
    expect(html).not.toContain('Reddit discussion')
    expect(html).not.toContain('Hacker News discussion')
  })
})
