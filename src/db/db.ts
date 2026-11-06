import Dexie, {type Table} from 'dexie'
import type {Feed, Folder, Post, SettingKey} from './types'

export const UI_STATE_SETTING_KEY = 'uiState'

export interface SettingRow {
    key: SettingKey | typeof UI_STATE_SETTING_KEY
    value: unknown
}

export class RssReaderDB extends Dexie {
    feeds!: Table<Feed, string>
    folders!: Table<Folder, string>
    posts!: Table<Post, string>
    settings!: Table<SettingRow, SettingRow['key']>

    constructor() {
        super('rss-reader')
        this.version(1).stores({
            feeds: 'id, &url, folderId, nextFetchAt',
            folders: 'id, sortOrder',
            posts:
                'id, feedId, [feedId+publishedAt], publishedAt, [statusKey+publishedAt], [starredKey+publishedAt], [feedId+statusKey+publishedAt]',
            settings: 'key'
        })
    }
}

export const db = new RssReaderDB()
