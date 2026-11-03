import {describe, expect, it} from 'vitest'
import {filterPosts} from '../../src/shared/model/search'
import {postFixture} from '../helpers/db'

describe('filterPosts', () => {
  it('matches the stored search text case-insensitively', () => {
    const posts = [
      postFixture({id: 'a', searchText: 'rust news a', publishedAt: 100}),
      postFixture({id: 'b', searchText: 'other rust in excerpt', publishedAt: 200}),
      postFixture({id: 'c', searchText: 'unrelated c', publishedAt: 300})
    ]

    expect(filterPosts(posts, 'RUST').map((post) => post.id)).toEqual(['b', 'a'])
  })

  it('returns no results for an empty query', () => {
    expect(filterPosts([postFixture({searchText: 'rust'})], '   ')).toEqual([])
  })

  it('caps results at 200 in published-desc order', () => {
    const posts = Array.from({length: 201}, (_, index) =>
      postFixture({
        id: `p${index}`,
        searchText: 'match',
        publishedAt: index
      })
    )

    const results = filterPosts(posts, 'match')

    expect(results).toHaveLength(200)
    expect(results[0].publishedAt).toBe(200)
    expect(results.at(-1)?.publishedAt).toBe(1)
  })
})
