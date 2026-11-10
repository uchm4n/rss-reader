import type {ThreadComment} from '@/shared/model/discussion'

export const REDDIT_INITIAL_COMMENTS = 200
export const REDDIT_MAX_COMMENTS = 500
export const REDDIT_COMMENTS_URL = 'https://www.reddit.com/comments'

export interface RedditComment extends ThreadComment {
    id: string
    author: string | null
    bodyHtml: string | null
    score: number | null
    createdAt: number
    permalink: string | null
    children: RedditComment[]
}

export interface RedditThread {
    postId: string
    postUrl: string
    totalComments: number | null
    hasMore: boolean
    comments: RedditComment[]
}

export interface FetchRedditThreadOptions {
    signal?: AbortSignal
    fetchImpl?: typeof fetch
    limit?: number
}

interface ParseState {
    hasMore: boolean
}

function record(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : null
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' ? value : null
}

function authorOrNull(value: unknown): string | null {
    const author = stringOrNull(value)
    if (!author) return null
    return /^\[(?:deleted|removed)\]$/i.test(author.trim()) ? null : author
}

function bodyOrNull(value: unknown): string | null {
    const html = stringOrNull(value)
    if (!html) return null
    const text = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
    return text === '[deleted]' || text === '[removed]' ? null : html
}

function numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function timestamp(value: unknown): number {
    const seconds = numberOrNull(value)
    return seconds !== null && seconds > 0 ? seconds * 1000 : 0
}

function redditPath(value: unknown): string | null {
    if (typeof value !== 'string' || !value.startsWith('/')) return null
    if (!value.startsWith('/r/') && !value.startsWith('/comments/')) return null
    return value
}

function redditUrl(value: unknown): string | null {
    const path = redditPath(value)
    return path ? `https://www.reddit.com${path}` : null
}

function parseComment(value: unknown, state: ParseState): RedditComment | null {
    const wrapper = record(value)
    if (!wrapper || wrapper.kind !== 't1') return null

    const data = record(wrapper.data)
    if (!data || typeof data.id !== 'string' || !data.id) return null

    const replies = record(data.replies)
    const replyData = replies ? record(replies.data) : null
    const rawChildren = Array.isArray(replyData?.children) ? replyData.children : []
    const children: RedditComment[] = []

    for (const child of rawChildren) {
        const childWrapper = record(child)
        if (childWrapper?.kind === 'more') {
            state.hasMore = true
            continue
        }
        const comment = parseComment(child, state)
        if (comment) children.push(comment)
    }

    return {
        id: data.id,
        author: authorOrNull(data.author),
        bodyHtml: bodyOrNull(data.body_html),
        score: numberOrNull(data.score),
        createdAt: timestamp(data.created_utc),
        permalink: redditUrl(data.permalink),
        children
    }
}

export function parseRedditThread(
    payload: unknown,
    postId: string
): RedditThread | null {
    if (!Array.isArray(payload) || payload.length < 2) return null

    const postListing = record(payload[0])
    const commentsListing = record(payload[1])
    const postData = record(postListing?.data)
    const commentsData = record(commentsListing?.data)
    const rawComments = commentsData?.children
    if (!Array.isArray(rawComments)) return null

    const rawPost = Array.isArray(postData?.children) ? postData.children[0] : null
    const post = record(rawPost)
    const postDetails = post ? record(post.data) : null
    const totalComments = numberOrNull(postDetails?.num_comments)
    const postUrl =
        redditUrl(postDetails?.permalink) ??
        `https://www.reddit.com/comments/${postId}`

    const state: ParseState = {hasMore: false}
    const comments: RedditComment[] = []

    for (const child of rawComments) {
        const wrapper = record(child)
        if (wrapper?.kind === 'more') {
            state.hasMore = true
            continue
        }
        const comment = parseComment(child, state)
        if (comment) comments.push(comment)
    }

    return {
        postId,
        postUrl,
        totalComments,
        hasMore: state.hasMore,
        comments
    }
}

function clampLimit(value: number | undefined): number {
    const requested = value ?? REDDIT_INITIAL_COMMENTS
    if (!Number.isFinite(requested)) return REDDIT_INITIAL_COMMENTS
    return Math.min(REDDIT_MAX_COMMENTS, Math.max(1, Math.trunc(requested)))
}

export async function fetchRedditThread(
    postId: string,
    options: FetchRedditThreadOptions = {}
): Promise<RedditThread> {
    const {signal, fetchImpl = fetch} = options
    const limit = clampLimit(options.limit)
    const response = await fetchImpl(
        `${REDDIT_COMMENTS_URL}/${encodeURIComponent(postId)}.json?raw_json=1&limit=${limit}`,
        {
            headers: {Accept: 'application/json'},
            signal
        }
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const thread = parseRedditThread(await response.json(), postId)
    if (!thread) throw new Error('Invalid discussion')
    return thread
}
