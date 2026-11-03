import {useCallback, useState} from 'react'
import type {Selection} from '@/shared/model/selection'

export const SELECTION_STORAGE_KEY = 'rss-reader:selection:v1'

export function parseSelection(raw: string | null): Selection {
    if (!raw) return {kind: 'all'}

    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return {kind: 'all'}
    }

    if (typeof parsed !== 'object' || parsed === null) return {kind: 'all'}
    const value = parsed as Record<string, unknown>

    if (value.kind === 'all' || value.kind === 'unread' || value.kind === 'starred') {
        return {kind: value.kind}
    }

    if (value.kind === 'feed' && typeof value.feedId === 'string' && value.feedId) {
        return {kind: 'feed', feedId: value.feedId}
    }

    if (value.kind === 'folder' && typeof value.folderId === 'string' && value.folderId) {
        return {kind: 'folder', folderId: value.folderId}
    }

    if (value.kind === 'search' && typeof value.query === 'string') {
        return {kind: 'search', query: value.query}
    }

    return {kind: 'all'}
}

export function useSelection() {
    const [selection, setSelectionState] = useState<Selection>(() => {
        try {
            const stored =
                typeof localStorage === 'undefined'
                    ? null
                    : localStorage.getItem(SELECTION_STORAGE_KEY)
            return parseSelection(stored)
        } catch {
            return {kind: 'all'}
        }
    })

    const setSelection = useCallback((next: Selection) => {
        setSelectionState(next)
        try {
            localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(next))
        } catch {
            // Persisting the last view is a convenience, not a requirement.
        }
    }, [])

    return {selection, setSelection}
}
