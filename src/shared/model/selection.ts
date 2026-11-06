export type Selection =
    | { kind: 'all' }
    | { kind: 'unread' }
    | { kind: 'starred' }
    | { kind: 'feed'; feedId: string }
    | { kind: 'folder'; folderId: string }
    | { kind: 'search'; query: string }

export function parseSelectionValue(value: unknown): Selection | null {
    if (typeof value !== 'object' || value === null) return null
    const parsed = value as Record<string, unknown>

    if (parsed.kind === 'all' || parsed.kind === 'unread' || parsed.kind === 'starred') {
        return {kind: parsed.kind}
    }

    if (parsed.kind === 'feed' && typeof parsed.feedId === 'string' && parsed.feedId) {
        return {kind: 'feed', feedId: parsed.feedId}
    }

    if (parsed.kind === 'folder' && typeof parsed.folderId === 'string' && parsed.folderId) {
        return {kind: 'folder', folderId: parsed.folderId}
    }

    if (parsed.kind === 'search' && typeof parsed.query === 'string') {
        return {kind: 'search', query: parsed.query}
    }

    return null
}

export function selectionKey(selection: Selection): string {
    switch (selection.kind) {
        case 'all':
            return 'all'
        case 'unread':
            return 'unread'
        case 'starred':
            return 'starred'
        case 'feed':
            return `feed:${selection.feedId}`
        case 'folder':
            return `folder:${selection.folderId}`
        case 'search':
            return `search:${selection.query}`
    }
}

export function selectionTitle(
    selection: Selection,
    folders: Array<{ id: string; name: string }>,
    feeds: Array<{ id: string; title: string }>
): string {
    switch (selection.kind) {
        case 'all':
            return 'All posts'
        case 'unread':
            return 'Unread'
        case 'starred':
            return 'Starred'
        case 'feed':
            return feeds.find((feed) => feed.id === selection.feedId)?.title ?? 'Feed'
        case 'folder':
            return folders.find((folder) => folder.id === selection.folderId)?.name ?? 'Folder'
        case 'search':
            return `Results for “${selection.query}”`
    }
}
