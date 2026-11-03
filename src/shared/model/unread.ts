export function totalUnread(feeds: ReadonlyArray<{ unreadCount: number }>): number {
    return feeds.reduce((sum, feed) => sum + feed.unreadCount, 0)
}
