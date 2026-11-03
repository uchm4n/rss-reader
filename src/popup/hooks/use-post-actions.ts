import {
    markPostsRead as markPostsReadInDb,
    setPostStatus as setPostStatusInDb,
    togglePostStar as togglePostStarInDb
} from '@/db/posts'
import {sendCommand} from '../lib/commands'

export async function setPostStatus(postId: string, status: boolean): Promise<void> {
    await setPostStatusInDb(postId, status)
    await sendCommand({type: 'action:refresh'})
}

export async function markPostsRead(postIds: string[]): Promise<void> {
    await markPostsReadInDb(postIds)
    await sendCommand({type: 'action:refresh'})
}

export async function togglePostStar(postId: string): Promise<void> {
    await togglePostStarInDb(postId)
}
