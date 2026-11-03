import Dexie, {type Table} from 'dexie'
import type {AppSettings, Feed, Folder, Post, SettingKey} from './types'

export interface SettingRow {
    key: SettingKey
    value: AppSettings[SettingKey]
}

export class RssReaderDB extends Dexie {
    feeds!: Table<Feed, string>
    folders!: Table<Folder, string>
    posts!: Table<Post, string>
    settings!: Table<SettingRow, SettingKey>

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
