import Dexie from 'dexie'
import {db} from './db'
import type {Post} from './types'
import {safeFindMatchedWords} from '../shared/model/match-words'

async function unreadCountForFeed(feedId: string): Promise<number> {
    return db.posts
        .where('[feedId+statusKey+publishedAt]')
        .between(
            [feedId, 0, Dexie.minKey],
            [feedId, 0, Dexie.maxKey]
        )
        .count()
}

export async function setPostStatus(
    postId: string,
    status: boolean,
    now = Date.now()
): Promise<void> {
    await db.transaction('rw', db.feeds, db.posts, async () => {
        const post = await db.posts.get(postId)
        if (!post) return

        await db.posts.update(postId, {
            status,
            statusKey: status ? 1 : 0,
            readAt: status ? now : null
        })
        await db.feeds.update(post.feedId, {
            unreadCount: await unreadCountForFeed(post.feedId)
        })
    })
}

export async function markPostsRead(
    postIds: string[],
    now = Date.now()
): Promise<void> {
    const unique = [...new Set(postIds)]
    if (!unique.length) return

    await db.transaction('rw', db.feeds, db.posts, async () => {
        const posts = await db.posts.bulkGet(unique)
        const unread = posts.filter(
            (post): post is Post => post !== undefined && !post.status
        )
        if (!unread.length) return

        await db.posts
            .where('id')
            .anyOf(unread.map((post) => post.id))
            .modify({status: true, statusKey: 1, readAt: now})

        for (const feedId of new Set(unread.map((post) => post.feedId))) {
            await db.feeds.update(feedId, {
                unreadCount: await unreadCountForFeed(feedId)
            })
        }
    })
}

export async function togglePostStar(
    postId: string,
    now = Date.now()
): Promise<void> {
    await db.transaction('rw', db.posts, async () => {
        const post = await db.posts.get(postId)
        if (!post) return

        const starred = !post.starred
        await db.posts.update(postId, {
            starred,
            starredKey: starred ? 1 : 0,
            starredAt: starred ? now : null
        })
    })
}

export async function countStarredPosts(): Promise<number> {
    return db.posts
        .where('[starredKey+publishedAt]')
        .between([1, Dexie.minKey], [1, Dexie.maxKey])
        .count()
}

export async function trimFeedPosts(
    feedId: string,
    retention: number
): Promise<{ trimmed: number; unread: number }> {
    return db.transaction('rw', db.feeds, db.posts, async () => {
        const limit = Math.max(1, Math.trunc(retention))
        const posts = await db.posts
            .where('[feedId+publishedAt]')
            .between([feedId, Dexie.minKey], [feedId, Dexie.maxKey])
            .toArray()
        posts.sort((left, right) => right.publishedAt - left.publishedAt)

        const remove = posts.slice(limit)
        if (remove.length) {
            await db.posts.bulkDelete(remove.map((post) => post.id))
        }

        const keep = posts.slice(0, limit)
        const unread = keep.filter((post) => !post.status).length
        const feed = await db.feeds.get(feedId)
        const matchedWords = safeFindMatchedWords(feed?.matchWords, keep)
        await db.feeds.update(feedId, {unreadCount: unread, matchedWords})

        return {trimmed: remove.length, unread}
    })
}
