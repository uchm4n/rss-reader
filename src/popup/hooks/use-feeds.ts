import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '@/db/db'
import type {Feed} from '@/db/types'

export function useFeeds(): Feed[] | undefined {
    return useLiveQuery(async () => {
        const feeds = await db.feeds.toArray()
        return feeds.sort((left, right) => left.title.localeCompare(right.title))
    }, [])
}
