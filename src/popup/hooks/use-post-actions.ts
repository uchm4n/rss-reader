import {setPostStatus as setPostStatusInDb, togglePostStar as togglePostStarInDb} from '@/db/posts'
import {syncActionBadge} from '@/background/badge'

export async function setPostStatus(postId: string, status: boolean): Promise<void> {
    await setPostStatusInDb(postId, status)
    await syncActionBadge()
}

export async function togglePostStar(postId: string): Promise<void> {
    await togglePostStarInDb(postId)
}
