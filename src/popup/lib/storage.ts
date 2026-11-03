import {db} from '@/db/db'

export interface StoreSummary {
    name: string
    label: string
    description: string
    count: number
}

const STORE_DETAILS: Record<string, { label: string; description: string; order: number }> = {
    feeds: {label: 'Feeds', description: 'Subscriptions and fetch state', order: 0},
    folders: {label: 'Folders', description: 'Feed groups', order: 1},
    posts: {label: 'Posts', description: 'Stored articles', order: 2},
    settings: {label: 'Settings', description: 'Preferences', order: 3}
}

export async function loadStoreSummary(): Promise<StoreSummary[]> {
    const tables = [...db.tables].sort(
        (left, right) =>
            (STORE_DETAILS[left.name]?.order ?? 99) - (STORE_DETAILS[right.name]?.order ?? 99)
    )

    return Promise.all(
        tables.map(async (table) => {
            const details = STORE_DETAILS[table.name]
            return {
                name: table.name,
                label: details?.label ?? table.name,
                description: details?.description ?? 'Dexie table',
                count: await table.count()
            }
        })
    )
}

export function formatBytes(bytes: number): string {
    if (!bytes) return '0 B'

    const units = ['B', 'KB', 'MB', 'GB']
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
    )
    const value = bytes / 1024 ** index
    return `${index === 0 ? value : value.toFixed(1)} ${units[index]}`
}

export function usagePercent(usage: number, quota: number): number {
    if (quota <= 0) return 0
    return Math.min(100, Math.max(0, (usage / quota) * 100))
}
