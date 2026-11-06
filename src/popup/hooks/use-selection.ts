import {useCallback, useState} from 'react'
import {parseSelectionValue, type Selection} from '@/shared/model/selection'

export const SELECTION_STORAGE_KEY = 'rss-reader:selection:v1'

export function parseSelection(raw: string | null): Selection {
    if (!raw) return {kind: 'all'}

    try {
        return parseSelectionValue(JSON.parse(raw)) ?? {kind: 'all'}
    } catch {
        return {kind: 'all'}
    }
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
