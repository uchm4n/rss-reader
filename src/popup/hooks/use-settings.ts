import {useLiveQuery} from 'dexie-react-hooks'
import {getSettings} from '@/db/settings'
import type {AppSettings} from '@/db/types'

export function useSettings(): AppSettings | undefined {
    return useLiveQuery(() => getSettings(), [])
}
