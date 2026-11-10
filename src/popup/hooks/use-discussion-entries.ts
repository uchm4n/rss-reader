import {useCallback, useMemo, useState} from 'react'
import {
    flattenDiscussion,
    visibleDiscussionEntries,
    type ThreadComment
} from '@/shared/model/discussion'

export function useDiscussionEntries<T extends ThreadComment>(comments: T[]) {
    const entries = useMemo(() => flattenDiscussion(comments), [comments])
    const [collapsed, setCollapsed] = useState<Set<string | number>>(() => new Set())

    const toggle = useCallback((id: string | number) => {
        setCollapsed((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const visibleEntries = useMemo(
        () => visibleDiscussionEntries(entries, collapsed),
        [entries, collapsed]
    )

    return {entries, visibleEntries, collapsed, toggle}
}
