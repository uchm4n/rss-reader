import {db} from '../db/db'
import {
    actionIconForCount,
    actionIconKind
} from '../shared/model/action-icon'
import {hasUnsubscribedForTab} from './discovery'
import {feedAddIcon} from './feed-add-icon'

const AMBER = '#f59e0b'
const WHITE = '#ffffff'

async function resolveTabId(tabId?: number): Promise<number | undefined> {
    if (tabId !== undefined) return tabId
    if (!chrome.tabs?.query) return undefined

    try {
        const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true})
        return tab?.id
    } catch {
        return undefined
    }
}

export async function refreshAction(
    tabId?: number,
    options: {forceDiscovery?: boolean} = {}
): Promise<void> {
    const feeds = await db.feeds.toArray()
    const unread = feeds.reduce((sum, feed) => sum + feed.unreadCount, 0)
    const text = unread > 0 ? String(unread) : ''
    const activeTabId = await resolveTabId(tabId)

    await chrome.action.setBadgeText({text})

    if (unread > 0) {
        await chrome.action.setBadgeBackgroundColor({color: AMBER})
        await chrome.action.setBadgeTextColor({color: WHITE})
    }

    const hasFeed =
        activeTabId === undefined
            ? false
            : await hasUnsubscribedForTab(activeTabId, {
                  force: options.forceDiscovery
              }).catch(() => false)
    const kind = actionIconKind(hasFeed, unread)

    if (activeTabId === undefined) {
        await chrome.action.setIcon({path: actionIconForCount(unread)})
        return
    }

    if (kind === 'add-gray' || kind === 'add-amber') {
        try {
            const imageData = await feedAddIcon(kind)
            await chrome.action.setIcon({tabId: activeTabId, imageData})
            return
        } catch (error) {
            console.error('RSS Reader could not build the add icon', error)
        }
    }

    await chrome.action.setIcon({
        tabId: activeTabId,
        path: actionIconForCount(unread)
    })
}

export const syncActionBadge = refreshAction
