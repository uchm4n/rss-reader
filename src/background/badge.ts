import {db} from '../db/db'
import {actionIconForCount} from '../shared/model/action-icon'

const AMBER = '#f59e0b'
const WHITE = '#ffffff'

export async function syncActionBadge(): Promise<void> {
    const feeds = await db.feeds.toArray()
    const unread = feeds.reduce((sum, feed) => sum + feed.unreadCount, 0)
    const text = unread > 0 ? String(unread) : ''

    await chrome.action.setBadgeText({text})
    await chrome.action.setIcon({path: actionIconForCount(unread)})

    if (unread > 0) {
        await chrome.action.setBadgeBackgroundColor({color: AMBER})
        await chrome.action.setBadgeTextColor({color: WHITE})
    }
}
