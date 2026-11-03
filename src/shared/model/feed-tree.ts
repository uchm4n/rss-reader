import type {Feed, Folder} from '@/db/types.ts'

export type FeedTreeNode =
    | { type: 'feed'; feed: Feed }
    | { type: 'folder'; id: string; name: string; unreadCount: number; items: FeedTreeNode[] }

export function buildFeedTree(feeds: Feed[], folders: Folder[]): FeedTreeNode[] {
    const folderIds = new Set(folders.map((folder) => folder.id))
    const byTitle = (left: Feed, right: Feed) => left.title.localeCompare(right.title)

    const folderNodes: FeedTreeNode[] = [...folders]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((folder) => {
            const items: FeedTreeNode[] = feeds
                .filter((feed) => feed.folderId === folder.id)
                .sort(byTitle)
                .map((feed) => ({type: 'feed', feed}))

            return {
                type: 'folder',
                id: folder.id,
                name: folder.name,
                unreadCount: items.reduce(
                    (sum, node) => sum + (node.type === 'feed' ? node.feed.unreadCount : 0),
                    0
                ),
                items
            }
        })

    const rootFeeds: FeedTreeNode[] = feeds
        .filter((feed) => !feed.folderId || !folderIds.has(feed.folderId))
        .sort(byTitle)
        .map((feed) => ({type: 'feed', feed}))

    return [...rootFeeds, ...folderNodes]
}
