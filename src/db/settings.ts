import {db} from './db'
import type {AppSettings} from './types'

export const DEFAULT_SETTINGS: AppSettings = {
    theme: 'system',
    refreshInterval: 900,
    retentionPerFeed: 50,
    notifications: false,
    markReadOnOpen: true,
    startView: 'all',
    persistUiState: true
}

export async function getSettings(): Promise<AppSettings> {
    const settings = {...DEFAULT_SETTINGS}
    const rows = await db.settings.toArray()

    for (const row of rows) {
        if (row.key in settings) {
            ;(settings as Record<string, unknown>)[row.key] = row.value
        }
    }

    return settings
}

export async function setSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
): Promise<void> {
    await db.settings.put({key, value})
}
