import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '@/db/db'
import type {Folder} from '@/db/types'

export function useFolders(): Folder[] | undefined {
    return useLiveQuery(() => db.folders.orderBy('sortOrder').toArray(), [])
}
