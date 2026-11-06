import {useCallback, useEffect, useState} from 'react'
import {db} from '@/db/db'
import {loadUiState, saveUiState, type PersistedUiState} from '@/db/ui-state'
import type {Selection} from '@/shared/model/selection'
import {useSelection} from './use-selection'

interface RestoredUiStateOptions {
    ready: boolean
    enabled: boolean
}

async function selectionExists(selection: Selection): Promise<boolean> {
    switch (selection.kind) {
        case 'feed':
            return Boolean(await db.feeds.get(selection.feedId))
        case 'folder':
            return Boolean(await db.folders.get(selection.folderId))
        default:
            return true
    }
}

export function useRestoredUiState({ready, enabled}: RestoredUiStateOptions) {
    const {selection, setSelection} = useSelection()
    const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
        () => new Set()
    )
    const [openPostId, setOpenPostId] = useState<string | null>(null)
    const [hydrated, setHydrated] = useState(false)
    const [restored, setRestored] = useState(false)

    useEffect(() => {
        if (!ready) return

        if (!enabled) {
            setHydrated(true)
            return
        }

        let cancelled = false
        setHydrated(false)

        void (async () => {
            let saved: PersistedUiState | null = null
            try {
                saved = await loadUiState()
            } catch {
                saved = null
            }

            if (cancelled) return

            if (saved && (await selectionExists(saved.selection))) {
                const post = saved.openPostId
                    ? await db.posts.get(saved.openPostId)
                    : null
                if (cancelled) return

                setSelection(saved.selection)
                setCollapsedFolderIds(new Set(saved.collapsedFolderIds))
                setOpenPostId(post ? saved.openPostId : null)
                setRestored(true)
            } else {
                setRestored(false)
            }

            setHydrated(true)
        })()

        return () => {
            cancelled = true
        }
    }, [ready, enabled, setSelection])

    useEffect(() => {
        if (!hydrated || !enabled) return

        void saveUiState({
            selection,
            collapsedFolderIds: [...collapsedFolderIds],
            openPostId
        }).catch(() => {
            // Remembering the last view is a convenience, not a requirement.
        })
    }, [hydrated, enabled, selection, collapsedFolderIds, openPostId])

    const select = useCallback(
        (next: Selection) => {
            setOpenPostId(null)
            setSelection(next)
        },
        [setSelection]
    )

    const toggleFolder = useCallback((folderId: string) => {
        setCollapsedFolderIds((previous) => {
            const next = new Set(previous)
            if (next.has(folderId)) next.delete(folderId)
            else next.add(folderId)
            return next
        })
    }, [])

    return {
        selection,
        select,
        collapsedFolderIds,
        toggleFolder,
        openPostId,
        setOpenPostId,
        hydrated,
        restored
    }
}
