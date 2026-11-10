import {describe, expect, it} from 'vitest'
import {
  flattenDiscussion,
  visibleDiscussionEntries
} from '../../src/shared/model/discussion'

const COMMENTS = [
  {
    id: 'a',
    children: [
      {id: 'b', children: [{id: 'c', children: []}]},
      {id: 'd', children: []}
    ]
  },
  {id: 'e', children: []}
]

describe('flattenDiscussion', () => {
  it('flattens comments in display order with depth and reply state', () => {
    expect(
      flattenDiscussion(COMMENTS).map(({comment, depth, hasReplies}) => ({
        id: comment.id,
        depth,
        hasReplies
      }))
    ).toEqual([
      {id: 'a', depth: 0, hasReplies: true},
      {id: 'b', depth: 1, hasReplies: true},
      {id: 'c', depth: 2, hasReplies: false},
      {id: 'd', depth: 1, hasReplies: false},
      {id: 'e', depth: 0, hasReplies: false}
    ])
  })

  it('supports numeric IDs', () => {
    const entries = flattenDiscussion([
      {id: 1, children: [{id: 2, children: []}]}
    ])

    expect(entries.map(({comment}) => comment.id)).toEqual([1, 2])
  })
})

describe('visibleDiscussionEntries', () => {
  const entries = flattenDiscussion(COMMENTS)

  it('keeps everything when nothing is collapsed', () => {
    expect(
      visibleDiscussionEntries(entries, new Set()).map(({comment}) => comment.id)
    ).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('hides a collapsed subtree and keeps following siblings', () => {
    expect(
      visibleDiscussionEntries(entries, new Set(['a'])).map(({comment}) => comment.id)
    ).toEqual(['a', 'e'])
  })

  it('hides only a nested subtree', () => {
    expect(
      visibleDiscussionEntries(entries, new Set(['b'])).map(({comment}) => comment.id)
    ).toEqual(['a', 'b', 'd', 'e'])
  })

  it('ignores a collapsed leaf', () => {
    expect(
      visibleDiscussionEntries(entries, new Set(['c'])).map(({comment}) => comment.id)
    ).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})
