import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '@/db/db'
import type {Post} from '@/db/types'

export function usePost(postId: string | null): Post | undefined {
    return useLiveQuery(
        () => (postId ? db.posts.get(postId) : undefined),
        [postId]
    )
}
