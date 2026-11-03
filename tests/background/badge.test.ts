import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {db} from '../../src/db/db'
import {
    GRAY_ACTION_ICONS,
    UNREAD_ACTION_ICONS
} from '../../src/shared/model/action-icon'
import {seedFeed} from '../helpers/db'

const {hasUnsubscribedForTab, feedAddIcon} = vi.hoisted(() => ({
    hasUnsubscribedForTab: vi.fn(),
    feedAddIcon: vi.fn()
}))

vi.mock('../../src/background/discovery', () => ({hasUnsubscribedForTab}))
vi.mock('../../src/background/feed-add-icon', () => ({feedAddIcon}))

import {syncActionBadge} from '../../src/background/badge'

const imageData = {16: {}, 32: {}, 48: {}, 128: {}}

function mockChromeAction() {
    const action = {
        setBadgeText: vi.fn(),
        setBadgeBackgroundColor: vi.fn(),
        setBadgeTextColor: vi.fn(),
        setIcon: vi.fn()
    }
    vi.stubGlobal('chrome', {
        action,
        tabs: {query: vi.fn().mockResolvedValue([{id: 1}])}
    })
    return action
}

beforeEach(() => {
    hasUnsubscribedForTab.mockResolvedValue(false)
    feedAddIcon.mockResolvedValue(imageData)
})

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
        expect(action.setIcon).toHaveBeenCalledWith({
            tabId: 1,
            path: GRAY_ACTION_ICONS
        })
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
        expect(action.setIcon).toHaveBeenCalledWith({
            tabId: 1,
            path: UNREAD_ACTION_ICONS
        })
    })

    it('uses the gray plus icon on a tab with an unsubscribed feed', async () => {
        hasUnsubscribedForTab.mockResolvedValue(true)
        await seedFeed({unreadCount: 0})
        const action = mockChromeAction()

        await syncActionBadge()

        expect(feedAddIcon).toHaveBeenCalledWith('add-gray')
        expect(action.setIcon).toHaveBeenCalledWith({tabId: 1, imageData})
    })

    it('uses the amber plus icon when that tab also has unread posts', async () => {
        hasUnsubscribedForTab.mockResolvedValue(true)
        await seedFeed({unreadCount: 3})
        const action = mockChromeAction()

        await syncActionBadge()

        expect(feedAddIcon).toHaveBeenCalledWith('add-amber')
        expect(action.setIcon).toHaveBeenCalledWith({tabId: 1, imageData})
    })
})
