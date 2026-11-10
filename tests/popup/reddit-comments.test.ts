import {describe, expect, it, vi} from 'vitest'
import {
  fetchRedditThread,
  parseRedditThread
} from '../../src/popup/lib/reddit-comments'

const PAYLOAD = [
  {
    kind: 'Listing',
    data: {
      children: [
        {
          kind: 't3',
          data: {
            num_comments: 42,
            permalink: '/r/test/comments/abc123/title/'
          }
        }
      ]
    }
  },
  {
    kind: 'Listing',
    data: {
      children: [
        {
          kind: 't1',
          data: {
            id: 'c1',
            author: 'alice',
            body_html: '<p>Hello</p>',
            score: 5,
            created_utc: 1700000000,
            permalink: '/r/test/comments/abc123/title/c1/',
            replies: {
              kind: 'Listing',
              data: {
                children: [
                  {
                    kind: 't1',
                    data: {
                      id: 'c2',
                      author: null,
                      body: '[deleted]',
                      body_html: null,
                      score: null,
                      created_utc: 0,
                      permalink: null,
                      replies: ''
                    }
                  }
                ]
              }
            }
          }
        },
        {kind: 'more', data: {count: 10, children: ['c3']}}
      ]
    }
  }
]

describe('parseRedditThread', () => {
  it('parses post metadata, nested comments and more nodes', () => {
    const thread = parseRedditThread(PAYLOAD, 'abc123')

    expect(thread).toMatchObject({
      postId: 'abc123',
      postUrl: 'https://www.reddit.com/r/test/comments/abc123/title/',
      totalComments: 42,
      hasMore: true
    })
    expect(thread?.comments).toHaveLength(1)
    expect(thread?.comments[0]).toMatchObject({
      id: 'c1',
      author: 'alice',
      bodyHtml: '<p>Hello</p>',
      score: 5,
      createdAt: 1700000000000,
      permalink: 'https://www.reddit.com/r/test/comments/abc123/title/c1/'
    })
    expect(thread?.comments[0].children[0]).toMatchObject({
      id: 'c2',
      author: null,
      bodyHtml: null,
      score: null,
      createdAt: 0,
      permalink: null
    })
  })

  it('normalizes deleted/removed authors and bodies but keeps children', () => {
    const payload = structuredClone(PAYLOAD) as any
    payload[1].data.children[0].data.author = '[deleted]'
    payload[1].data.children[0].data.body_html =
      '<div class="md"><p>[deleted]</p></div>'

    const thread = parseRedditThread(payload, 'abc123')

    expect(thread?.comments[0]).toMatchObject({
      id: 'c1',
      author: null,
      bodyHtml: null
    })
    expect(thread?.comments[0].children).toHaveLength(1)
  })

  it('marks nested more nodes without creating empty comments', () => {
    const payload = structuredClone(PAYLOAD) as any
    payload[1].data.children[0].data.replies.data.children.push({
      kind: 'more',
      data: {count: 2, children: ['c9']}
    })

    const thread = parseRedditThread(payload, 'abc123')

    expect(thread?.hasMore).toBe(true)
    expect(thread?.comments[0].children.map((comment) => comment.id)).toEqual([
      'c2'
    ])
  })

  it('skips malformed comments and keeps valid siblings', () => {
    const payload = structuredClone(PAYLOAD) as any
    payload[1].data.children.unshift({kind: 't1', data: {}})

    const thread = parseRedditThread(payload, 'abc123')

    expect(thread?.comments.map((comment) => comment.id)).toEqual(['c1'])
  })

  it('rejects malformed payloads', () => {
    expect(parseRedditThread(null, 'abc123')).toBeNull()
    expect(parseRedditThread({}, 'abc123')).toBeNull()
    expect(parseRedditThread([], 'abc123')).toBeNull()
    expect(parseRedditThread([{kind: 'Listing'}], 'abc123')).toBeNull()
  })

  it('uses the canonical post URL when the permalink is missing', () => {
    const payload = structuredClone(PAYLOAD) as any
    payload[0].data.children[0].data.permalink = ''
    payload[0].data.children[0].data.num_comments = 1

    const thread = parseRedditThread(payload, 'abc123')

    expect(thread?.postUrl).toBe('https://www.reddit.com/comments/abc123')
    expect(thread?.totalComments).toBe(1)
  })
})

describe('fetchRedditThread', () => {
  it('requests the comments JSON with a limit', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(PAYLOAD), {status: 200})
    )

    const thread = await fetchRedditThread('abc123', {
      fetchImpl,
      limit: 200
    })

    expect(thread.totalComments).toBe(42)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.reddit.com/comments/abc123.json?raw_json=1&limit=200',
      expect.objectContaining({headers: {Accept: 'application/json'}})
    )
  })

  it('clamps the limit to Reddit’s maximum', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(PAYLOAD), {status: 200})
    )

    await fetchRedditThread('abc123', {fetchImpl, limit: 900})

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.reddit.com/comments/abc123.json?raw_json=1&limit=500',
      expect.anything()
    )
  })

  it('rejects HTTP errors and invalid payloads', async () => {
    const error = vi.fn<typeof fetch>(async () => new Response('', {status: 403}))
    const invalid = vi.fn<typeof fetch>(async () =>
      new Response('{}', {status: 200})
    )

    await expect(
      fetchRedditThread('abc123', {fetchImpl: error})
    ).rejects.toThrow('HTTP 403')
    await expect(
      fetchRedditThread('abc123', {fetchImpl: invalid})
    ).rejects.toThrow('Invalid discussion')
  })
})
