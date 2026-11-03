import Dexie from 'dexie'
import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '@/db/db'
import type {Post} from '@/db/types'
import {filterPosts} from '@/shared/model/search'
import {type Selection, selectionKey} from '@/shared/model/selection'

const MAX_POSTS = 200

export async function loadPostsForFeed(feedId: string): Promise<Post[]> {
    return db.posts
        .where('[feedId+publishedAt]')
        .between([feedId, Dexie.minKey], [feedId, Dexie.maxKey])
        .reverse()
        .toArray()
}

export function usePosts(selection: Selection): Post[] | undefined {
    const key = selectionKey(selection)

    return useLiveQuery(async () => {
        switch (selection.kind) {
            case 'all':
                return db.posts.orderBy('publishedAt').reverse().limit(MAX_POSTS).toArray()

            case 'feed':
                return loadPostsForFeed(selection.feedId)

            case 'unread':
                return db.posts
                    .where('[statusKey+publishedAt]')
                    .between([0, Dexie.minKey], [0, Dexie.maxKey])
                    .reverse()
                    .limit(MAX_POSTS)
                    .toArray()

            case 'starred':
                return db.posts
                    .where('[starredKey+publishedAt]')
                    .between([1, Dexie.minKey], [1, Dexie.maxKey])
                    .reverse()
                    .limit(MAX_POSTS)
                    .toArray()

            case 'folder': {
                const feeds = await db.feeds
                    .where('folderId')
                    .equals(selection.folderId)
                    .toArray()
                if (!feeds.length) return []

                const posts = await db.posts
                    .where('feedId')
                    .anyOf(feeds.map((feed) => feed.id))
                    .toArray()
                return posts.sort((left, right) => right.publishedAt - left.publishedAt).slice(0, MAX_POSTS)
            }

            case 'search': {
                const posts = await db.posts.toArray()
                return filterPosts(posts, selection.query, MAX_POSTS)
            }
        }
    }, [key])
}
