import Dexie from 'dexie'
import {db} from '../db/db'
import type {Feed, Post} from '../db/types'
import type {ParsedFeed} from '../shared/parser/parse-feed'
import {postKey} from '../shared/parser/ids'

export interface IngestResult {
    inserted: number
    trimmed: number
    unread: number
}

function feedPostsQuery(feedId: string) {
    return db.posts
        .where('[feedId+publishedAt]')
        .between([feedId, Dexie.minKey], [feedId, Dexie.maxKey])
}

export async function ingestFeed(
    feed: Feed,
    parsed: ParsedFeed,
    options: { retention: number; firstFetch: boolean; now?: number }
): Promise<IngestResult> {
    return db.transaction('rw', db.feeds, db.posts, async () => {
        const currentFeed = await db.feeds.get(feed.id)
        if (!currentFeed) return {inserted: 0, trimmed: 0, unread: 0}

        const now = options.now ?? Date.now()
        const ids = parsed.items.map((item) =>
            postKey(feed.id, item.guid, item.link, item.title, item.publishedAt)
        )
        const direct = await db.posts.bulkGet(ids)
        const feedPosts = await feedPostsQuery(feed.id).toArray()
        const claimed = new Set(
            direct.filter((post): post is Post => Boolean(post)).map((post) => post.id)
        )
        const rows = new Map<string, Post>()
        let inserted = 0

        parsed.items.forEach((item, index) => {
            const generatedId = ids[index]
            let previous = direct[index] ?? rows.get(generatedId)

            const unclaimed = feedPosts.filter(
                (post) => !claimed.has(post.id) && !rows.has(post.id)
            )

            if (!previous && item.link) {
                const matches = unclaimed.filter((post) => post.link === item.link)
                if (matches.length === 1) previous = matches[0]
            }
            if (!previous && item.publishedAt > 0) {
                const matches = unclaimed.filter(
                    (post) =>
                        post.title === item.title && post.publishedAt === item.publishedAt
                )
                if (matches.length === 1) previous = matches[0]
            }

            const id = previous?.id ?? generatedId
            if (previous) claimed.add(previous.id)

            const publishedAt = item.publishedAt || previous?.publishedAt || now
            const common = {
                id,
                feedId: feed.id,
                guid: item.guid,
                title: item.title,
                link: item.link,
                publishedAt,
                fetchedAt: previous?.fetchedAt ?? now,
                excerpt: item.excerpt,
                contentHtml: item.contentHtml,
                imageUrl: item.imageUrl,
                author: item.author,
                searchText: `${item.title} ${item.excerpt} ${item.link ?? ''}`.toLowerCase()
            }

            if (previous) {
                rows.set(id, {...previous, ...common})
                return
            }

            const firstFetch = options.firstFetch
            inserted += 1
            rows.set(id, {
                ...common,
                status: firstFetch,
                starred: false,
                statusKey: firstFetch ? 1 : 0,
                starredKey: 0,
                readAt: firstFetch ? now : null,
                starredAt: null,
                extractedHtml: null,
                extractionStatus: 'idle',
                imageCacheKeys: []
            })
        })

        const values = [...rows.values()]
        if (values.length) {
            await db.posts.bulkPut(values)
        }

        const posts = await feedPostsQuery(feed.id).toArray()
        posts.sort((left, right) => right.publishedAt - left.publishedAt)
        const retention = Math.max(1, Math.trunc(options.retention))
        const remove = posts.slice(retention)
        if (remove.length) {
            await db.posts.bulkDelete(remove.map((post) => post.id))
        }

        const keep = posts.slice(0, retention)
        const unread = keep.filter((post) => !post.status).length
        await db.feeds.update(feed.id, {unreadCount: unread})

        return {inserted, trimmed: remove.length, unread}
    })
}
