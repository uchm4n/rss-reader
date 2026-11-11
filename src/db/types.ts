import type {ContentFormat} from '../shared/model/post'

export interface Feed {
    id: string
    url: string
    sourceUrl?: string
    siteUrl: string | null
    title: string
    description: string | null
    favicon: string | null
    faviconSourceUrl?: string | null
    faviconCachedAt?: number | null
    folderId: string | null
    refreshInterval: number | null
    retentionPerFeed?: number | null
    lastFetchedAt: number | null
    nextFetchAt: number
    etag: string | null
    lastModified: string | null
    fetchMode?: 'background' | 'page'
    errorCount: number
    lastError: string | null
    unreadCount: number
    matchWords?: string[]
    matchedWords?: string[]
    createdAt: number
    updatedAt: number
}

export interface Folder {
    id: string
    name: string
    sortOrder: number
    createdAt: number
    updatedAt: number
}

export type ExtractionStatus = 'idle' | 'pending' | 'done' | 'error'

export interface Post {
    id: string
    feedId: string
    guid: string | null
    title: string
    link: string | null
    publishedAt: number
    fetchedAt: number
    excerpt: string
    contentHtml: string | null
    contentType?: ContentFormat
    imageUrl: string | null
    author: string | null
    status: boolean
    starred: boolean
    statusKey: 0 | 1
    starredKey: 0 | 1
    readAt: number | null
    starredAt: number | null
    searchText: string
    extractedHtml: string | null
    extractionStatus: ExtractionStatus
    imageCacheKeys: string[]
}

export interface AppSettings {
    theme: 'light' | 'dark' | 'system'
    refreshInterval: number
    retentionPerFeed: number
    notifications: boolean
    markReadOnOpen: boolean
    startView: 'all' | 'unread' | 'starred'
    persistUiState: boolean
}

export type SettingKey = keyof AppSettings
