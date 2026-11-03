export type ActionIconPaths = Record<'16' | '32' | '48' | '128', string>

export const GRAY_ACTION_ICONS: ActionIconPaths = {
    16: '/extension-icons/icon-gray-16.png',
    32: '/extension-icons/icon-gray-32.png',
    48: '/extension-icons/icon-gray-48.png',
    128: '/extension-icons/icon-gray-128.png'
}

export const UNREAD_ACTION_ICONS: ActionIconPaths = {
    16: '/extension-icons/icon-unread-16.png',
    32: '/extension-icons/icon-unread-32.png',
    48: '/extension-icons/icon-unread-48.png',
    128: '/extension-icons/icon-unread-128.png'
}

export type ActionIconKind = 'gray' | 'unread' | 'add-gray' | 'add-amber'

export function actionIconForCount(count: number): ActionIconPaths {
    return count > 0 ? UNREAD_ACTION_ICONS : GRAY_ACTION_ICONS
}

export function actionIconKind(
    hasUnsubscribedFeed: boolean,
    unreadCount: number
): ActionIconKind {
    if (hasUnsubscribedFeed) {
        return unreadCount > 0 ? 'add-amber' : 'add-gray'
    }
    return unreadCount > 0 ? 'unread' : 'gray'
}
