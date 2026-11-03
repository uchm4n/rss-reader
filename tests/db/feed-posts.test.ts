import {afterEach, describe, expect, it} from 'vitest'
import {loadPostsForFeed} from '../../src/popup/hooks/use-posts'
import {db} from '../../src/db/db'
import {postFixture, seedFeed} from '../helpers/db'

afterEach(async () => {
  await db.delete()
  await db.open()
})

describe('loadPostsForFeed', () => {
  it('returns every retained post for a single feed', async () => {
    await seedFeed()
    await db.posts.bulkAdd(
      Array.from({length: 201}, (_, index) =>
        postFixture({
          id: `post-${index}`,
          guid: `post-${index}`,
          publishedAt: index
        })
      )
    )

    const posts = await loadPostsForFeed('feed-1')

    expect(posts).toHaveLength(201)
    expect(posts[0].publishedAt).toBe(200)
    expect(posts.at(-1)?.publishedAt).toBe(0)
  })
})
