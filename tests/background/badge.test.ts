import {afterEach, describe, expect, it, vi} from 'vitest'
import {syncActionBadge} from '../../src/background/badge'
import {db} from '../../src/db/db'
import {
  GRAY_ACTION_ICONS,
  UNREAD_ACTION_ICONS
} from '../../src/shared/model/action-icon'
import {seedFeed} from '../helpers/db'

function mockChromeAction() {
  const action = {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    setBadgeTextColor: vi.fn(),
    setIcon: vi.fn()
  }
  vi.stubGlobal('chrome', {action})
  return action
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await db.delete()
  await db.open()
})

describe('syncActionBadge', () => {
  it('clears the badge when there are no unread posts', async () => {
    await seedFeed({id: 'feed-1', unreadCount: 0})
    const action = mockChromeAction()

    await syncActionBadge()

    expect(action.setBadgeText).toHaveBeenCalledWith({text: ''})
    expect(action.setIcon).toHaveBeenCalledWith({path: GRAY_ACTION_ICONS})
  })

  it('shows the total unread count with the amber icon', async () => {
    await seedFeed({id: 'feed-1', unreadCount: 2})
    await seedFeed({
      id: 'feed-2',
      url: 'https://example.com/two.xml',
      unreadCount: 3
    })
    const action = mockChromeAction()

    await syncActionBadge()

    expect(action.setBadgeText).toHaveBeenCalledWith({text: '5'})
    expect(action.setBadgeBackgroundColor).toHaveBeenCalledWith({color: '#f59e0b'})
    expect(action.setBadgeTextColor).toHaveBeenCalledWith({color: '#ffffff'})
    expect(action.setIcon).toHaveBeenCalledWith({path: UNREAD_ACTION_ICONS})
  })
})
