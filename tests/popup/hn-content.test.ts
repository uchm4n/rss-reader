// @vitest-environment jsdom
import {describe, expect, it, vi} from 'vitest'
import {
  fetchHnThread,
  flattenHnComments,
  hnItemId,
  isHnCommentsOnly,
  parseHnThread,
  visibleHnEntries,
  type HnThread
} from '../../src/popup/lib/hn-content'

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

describe('hnItemId', () => {
  it('finds the item id in the standard HN RSS description', () => {
    expect(
      hnItemId({link: 'https://example.com/post', contentHtml: COMMENTS_LINK})
    ).toBe(50406563)
  })

  it('falls back to the post link for Ask HN posts', () => {
    expect(
      hnItemId({
        link: 'https://news.ycombinator.com/item?id=42',
        contentHtml: null
      })
    ).toBe(42)
  })

  it('ignores lookalike hosts and unrelated paths', () => {
    expect(
      hnItemId({
        link: 'https://news.ycombinator.com.evil.test/item?id=42',
        contentHtml: null
      })
    ).toBeNull()
    expect(
      hnItemId({
        link: 'https://news.ycombinator.com/user?id=42',
        contentHtml: null
      })
    ).toBeNull()
    expect(
      hnItemId({
        link: null,
        contentHtml: '<a href="https://example.com/item?id=42">Comments</a>'
      })
    ).toBeNull()
    expect(hnItemId({link: null, contentHtml: null})).toBeNull()
  })
})

describe('isHnCommentsOnly', () => {
  it('matches the standard HN RSS description', () => {
    expect(isHnCommentsOnly(COMMENTS_LINK)).toBe(true)
  })

  it('rejects descriptions with other content', () => {
    expect(isHnCommentsOnly(`<p>Summary</p>${COMMENTS_LINK}`)).toBe(false)
    expect(
      isHnCommentsOnly('<a href="https://example.com">Comments</a>')
    ).toBe(false)
    expect(isHnCommentsOnly(null)).toBe(false)
  })
})

describe('parseHnThread', () => {
  it('parses a story and its nested comments', () => {
    const thread = parseHnThread(STORY)

    expect(thread).toMatchObject({
      id: 50406563,
      title: 'The end of Microsoft Research AI Frontiers',
      author: 'srean',
      points: 294,
      createdAt: 1794074537000,
      url: 'https://hunch.net/?p=13764006',
      text: null
    })
    expect(thread?.comments).toHaveLength(2)
    expect(thread?.comments[0]).toMatchObject({
      id: 50406862,
      author: 'bob',
      text: '<p>First comment</p>'
    })
    expect(thread?.comments[0].children[0]).toMatchObject({
      id: 50406906,
      author: null,
      text: null
    })
  })

  it('accepts a story without comments', () => {
    const thread = parseHnThread({id: 7, title: 'No comments'})

    expect(thread?.id).toBe(7)
    expect(thread?.comments).toEqual([])
  })

  it('rejects malformed payloads', () => {
    expect(parseHnThread(null)).toBeNull()
    expect(parseHnThread('nope')).toBeNull()
    expect(parseHnThread({})).toBeNull()
    expect(parseHnThread({id: '7'})).toBeNull()
  })
})

describe('flattenHnComments', () => {
  it('flattens comments in display order with their depth', () => {
    const thread = parseHnThread(STORY) as HnThread

    expect(
      flattenHnComments(thread.comments).map(({comment, depth}) => ({
        id: comment.id,
        depth
      }))
    ).toEqual([
      {id: 50406862, depth: 0},
      {id: 50406906, depth: 1},
      {id: 50408007, depth: 0}
    ])
  })
})

describe('visibleHnEntries', () => {
  const entries = flattenHnComments((parseHnThread(STORY) as HnThread).comments)
  const nested = parseHnThread({
    id: 1,
    children: [
      {
        id: 2,
        text: 'root',
        children: [
          {
            id: 3,
            text: 'child',
            children: [{id: 4, text: 'grandchild', children: []}]
          },
          {id: 5, text: 'sibling', children: []}
        ]
      },
      {id: 6, text: 'next root', children: []}
    ]
  }) as HnThread
  const nestedEntries = flattenHnComments(nested.comments)

  it('keeps everything when nothing is collapsed', () => {
    expect(visibleHnEntries(entries, new Set()).map(({comment}) => comment.id)).toEqual([
      50406862, 50406906, 50408007
    ])
  })

  it('hides the collapsed subtree and keeps following siblings', () => {
    expect(
      visibleHnEntries(entries, new Set([50406862])).map(({comment}) => comment.id)
    ).toEqual([50406862, 50408007])
  })

  it('hides only a nested subtree', () => {
    expect(
      visibleHnEntries(nestedEntries, new Set([3])).map(({comment}) => comment.id)
    ).toEqual([2, 3, 5, 6])
  })

  it('ignores a collapsed leaf', () => {
    expect(
      visibleHnEntries(nestedEntries, new Set([4])).map(({comment}) => comment.id)
    ).toEqual([2, 3, 4, 5, 6])
  })
})

describe('fetchHnThread', () => {
  it('requests the item API and parses the thread', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({id: 7, children: []}), {status: 200})
    )

    await expect(fetchHnThread(7, {fetchImpl})).resolves.toMatchObject({id: 7})
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://hn.algolia.com/api/v1/items/7',
      expect.objectContaining({headers: {Accept: 'application/json'}})
    )
  })

  it('rejects HTTP errors and invalid payloads', async () => {
    const error = vi.fn<typeof fetch>(async () =>
      new Response('', {status: 500})
    )
    const invalid = vi.fn<typeof fetch>(async () =>
      new Response('{}', {status: 200})
    )

    await expect(fetchHnThread(7, {fetchImpl: error})).rejects.toThrow('HTTP 500')
    await expect(fetchHnThread(7, {fetchImpl: invalid})).rejects.toThrow(
      'Invalid discussion'
    )
  })
})
