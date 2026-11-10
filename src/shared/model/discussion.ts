export interface ThreadComment {
    id: string | number
    children: ThreadComment[]
}

export interface DiscussionEntry<T extends ThreadComment> {
    comment: T
    depth: number
    hasReplies: boolean
}

export function flattenDiscussion<T extends ThreadComment>(
    comments: T[]
): DiscussionEntry<T>[] {
    const entries: DiscussionEntry<T>[] = []

    const walk = (list: T[], depth: number) => {
        for (const comment of list) {
            entries.push({
                comment,
                depth,
                hasReplies: comment.children.length > 0
            })
            walk(comment.children, depth + 1)
        }
    }

    walk(comments, 0)
    return entries
}

export function visibleDiscussionEntries<T extends ThreadComment>(
    entries: DiscussionEntry<T>[],
    collapsed: ReadonlySet<string | number>
): DiscussionEntry<T>[] {
    const visible: DiscussionEntry<T>[] = []
    const hiddenDepths: number[] = []

    for (const entry of entries) {
        while (
            hiddenDepths.length > 0 &&
            hiddenDepths[hiddenDepths.length - 1] >= entry.depth
        ) {
            hiddenDepths.pop()
        }
        if (hiddenDepths.length > 0) continue

        visible.push(entry)
        if (collapsed.has(entry.comment.id) && entry.hasReplies) {
            hiddenDepths.push(entry.depth)
        }
    }

    return visible
}
