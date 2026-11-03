import {describe, expect, it} from 'vitest'
import {postKey} from '../../src/shared/parser/ids'

describe('postKey', () => {
  it('prefers the guid for the identity', () => {
    expect(postKey('feed-1', 'guid-1', 'https://example.com/1', 'Title', 10)).toBe(
      'feed-1:guid-1'
    )
  })

  it('falls back to the link when the guid is missing', () => {
    expect(postKey('feed-1', null, 'https://example.com/1', 'Title', 10)).toBe(
      'feed-1:https://example.com/1'
    )
  })

  it('is stable when only the title and date identify an item', () => {
    const first = postKey('feed-1', null, null, 'Same title', 10)
    const second = postKey('feed-1', null, null, 'Same title', 10)

    expect(first).toBe(second)
    expect(first).not.toBe(postKey('feed-1', null, null, 'Same title', 11))
  })
})
