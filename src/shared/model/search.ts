import type {Post} from '../../db/types'

const MAX_RESULTS = 200

export function filterPosts(
    posts: Post[],
    query: string,
    limit = MAX_RESULTS
): Post[] {
    const needle = query.trim().toLowerCase()
    if (!needle) return []

    return posts
        .filter((post) => post.searchText.includes(needle))
        .sort((left, right) => right.publishedAt - left.publishedAt)
        .slice(0, Math.max(0, limit))
}
