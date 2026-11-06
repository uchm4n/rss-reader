import {db, UI_STATE_SETTING_KEY} from './db'
import {parseSelectionValue, type Selection} from '../shared/model/selection'

export const UI_STATE_VERSION = 1

export interface PersistedUiState {
    version: typeof UI_STATE_VERSION
    selection: Selection
    collapsedFolderIds: string[]
    openPostId: string | null
}

export type SavedUiState = Omit<PersistedUiState, 'version'>

export function parseUiState(value: unknown): PersistedUiState | null {
    if (typeof value !== 'object' || value === null) return null

    const record = value as Record<string, unknown>
    if (record.version !== UI_STATE_VERSION) return null

    const selection = parseSelectionValue(record.selection)
    if (!selection) return null

    const collapsedFolderIds = Array.isArray(record.collapsedFolderIds)
        ? [
            ...new Set(
                record.collapsedFolderIds.filter(
                    (id): id is string => typeof id === 'string' && id.length > 0
                )
            )
        ]
        : []

    const openPostId =
        typeof record.openPostId === 'string' && record.openPostId
            ? record.openPostId
            : null

    return {
        version: UI_STATE_VERSION,
        selection,
        collapsedFolderIds,
        openPostId
    }
}

export async function loadUiState(): Promise<PersistedUiState | null> {
    const row = await db.settings.get(UI_STATE_SETTING_KEY)
    return row ? parseUiState(row.value) : null
}

export async function saveUiState(state: SavedUiState): Promise<void> {
    await db.settings.put({
        key: UI_STATE_SETTING_KEY,
        value: {version: UI_STATE_VERSION, ...state}
    })
}

export async function clearUiState(): Promise<void> {
    await db.settings.delete(UI_STATE_SETTING_KEY)
}
