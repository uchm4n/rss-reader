import {afterEach, describe, expect, it} from 'vitest'
import {db, UI_STATE_SETTING_KEY} from '../../src/db/db'
import {
    clearUiState,
    loadUiState,
    parseUiState,
    saveUiState
} from '../../src/db/ui-state'

afterEach(async () => {
    await db.delete()
    await db.open()
})

describe('ui state repository', () => {
    it('returns null when nothing is stored', async () => {
        await expect(loadUiState()).resolves.toBeNull()
    })

    it('round-trips the restored state', async () => {
        await saveUiState({
            selection: {kind: 'feed', feedId: 'feed-1'},
            collapsedFolderIds: ['folder-1', 'folder-2'],
            openPostId: 'post-1'
        })

        await expect(loadUiState()).resolves.toEqual({
            version: 1,
            selection: {kind: 'feed', feedId: 'feed-1'},
            collapsedFolderIds: ['folder-1', 'folder-2'],
            openPostId: 'post-1'
        })
    })

    it('clears the stored state', async () => {
        await saveUiState({
            selection: {kind: 'all'},
            collapsedFolderIds: [],
            openPostId: null
        })
        await clearUiState()

        await expect(loadUiState()).resolves.toBeNull()
        await expect(db.settings.get(UI_STATE_SETTING_KEY)).resolves.toBeUndefined()
    })

    it('rejects malformed or outdated state', async () => {
        await db.settings.put({
            key: UI_STATE_SETTING_KEY,
            value: {
                version: 2,
                selection: {kind: 'all'},
                collapsedFolderIds: [],
                openPostId: null
            }
        })

        await expect(loadUiState()).resolves.toBeNull()
    })
})

describe('parseUiState', () => {
    it('normalizes missing or invalid optional fields', () => {
        expect(
            parseUiState({
                version: 1,
                selection: {kind: 'unread'},
                collapsedFolderIds: ['a', 42, ''],
                openPostId: 7
            })
        ).toEqual({
            version: 1,
            selection: {kind: 'unread'},
            collapsedFolderIds: ['a'],
            openPostId: null
        })
    })

    it('rejects a missing selection', () => {
        expect(parseUiState({version: 1, collapsedFolderIds: []})).toBeNull()
    })
})
