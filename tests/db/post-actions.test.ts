import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {
  setPostStatus,
  togglePostStar
} from '../../src/popup/hooks/use-post-actions'
import {db} from '../../src/db/db'
import {postFixture, seedFeed} from '../helpers/db'

let setBadgeText: ReturnType<typeof vi.fn>

beforeEach(() => {
  setBadgeText = vi.fn()
  vi.stubGlobal('chrome', {
    action: {
      setBadgeText,
      setBadgeBackgroundColor: vi.fn(),
      setBadgeTextColor: vi.fn(),
      setIcon: vi.fn()
    }
  })
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await db.delete()
  await db.open()
})

describe('popup post actions', () => {
  it('marks a post read and clears the toolbar badge', async () => {
    await seedFeed({unreadCount: 1})
    await db.posts.add(postFixture({id: 'p1'}))

    await setPostStatus('p1', true)

    expect(await db.posts.get('p1')).toMatchObject({status: true, statusKey: 1})
    expect((await db.feeds.get('feed-1'))?.unreadCount).toBe(0)
    expect(setBadgeText).toHaveBeenLastCalledWith({text: ''})
  })

  it('toggles the star through the popup action', async () => {
    await seedFeed()
    await db.posts.add(postFixture({id: 'p1'}))

    await togglePostStar('p1')

    expect(await db.posts.get('p1')).toMatchObject({starred: true, starredKey: 1})
  })
})
