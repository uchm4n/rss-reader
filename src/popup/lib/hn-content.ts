export interface HnComment {
    id: number
    author: string | null
    createdAt: number
    text: string | null
    children: HnComment[]
}

export interface HnThread {
    id: number
    title: string | null
    author: string | null
    points: number | null
    createdAt: number
    url: string | null
    text: string | null
    comments: HnComment[]
}

export interface HnEntry {
    comment: HnComment
    depth: number
}

export const HN_VISIBLE_COMMENTS = 200
export const HN_ITEM_URL = 'https://news.ycombinator.com/item?id='
export const HN_API_URL = 'https://hn.algolia.com/api/v1/items'

function itemIdFromUrl(raw: string | null | undefined): number | null {
    if (!raw) return null

    let url: URL
    try {
        url = new URL(raw)
    } catch {
        return null
    }

    if (url.protocol !== 'https:') return null
    if (url.hostname.toLowerCase() !== 'news.ycombinator.com') return null
    if (url.pathname !== '/item' && url.pathname !== '/item/') return null

    const rawId = url.searchParams.get('id')
    if (!rawId || !/^\d+$/.test(rawId)) return null

    const id = Number(rawId)
    return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function hnItemId(post: {
    link: string | null
    contentHtml: string | null
}): number | null {
    if (post.contentHtml) {
        const doc = new DOMParser().parseFromString(post.contentHtml, 'text/html')
        for (const anchor of doc.querySelectorAll<HTMLAnchorElement>('a[href]')) {
            const id = itemIdFromUrl(anchor.getAttribute('href'))
            if (id !== null) return id
        }
    }

    return itemIdFromUrl(post.link)
}

export function isHnCommentsOnly(html: string | null): boolean {
    if (!html) return false

    const doc = new DOMParser().parseFromString(html, 'text/html')
    const anchors = doc.body.querySelectorAll<HTMLAnchorElement>('a[href]')
    if (anchors.length !== 1) return false
    if ((doc.body.textContent ?? '').trim().toLowerCase() !== 'comments') return false

    return itemIdFromUrl(anchors[0].getAttribute('href')) !== null
}

function record(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : null
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' ? value : null
}

function numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function timestamp(value: unknown): number {
    const seconds = numberOrNull(value)
    return seconds !== null && seconds > 0 ? seconds * 1000 : 0
}

function parseComment(value: unknown): HnComment | null {
    const data = record(value)
    if (!data || !Number.isSafeInteger(data.id)) return null

    const children = Array.isArray(data.children)
        ? data.children
            .map(parseComment)
            .filter((comment): comment is HnComment => comment !== null)
        : []

    return {
        id: data.id as number,
        author: stringOrNull(data.author),
        createdAt: timestamp(data.created_at_i),
        text: stringOrNull(data.text),
        children
    }
}

export function parseHnThread(value: unknown): HnThread | null {
    const data = record(value)
    if (!data || !Number.isSafeInteger(data.id)) return null

    const comments = Array.isArray(data.children)
        ? data.children
            .map(parseComment)
            .filter((comment): comment is HnComment => comment !== null)
        : []

    return {
        id: data.id as number,
        title: stringOrNull(data.title),
        author: stringOrNull(data.author),
        points: numberOrNull(data.points),
        createdAt: timestamp(data.created_at_i),
        url: stringOrNull(data.url),
        text: stringOrNull(data.text),
        comments
    }
}

export function flattenHnComments(comments: HnComment[]): HnEntry[] {
    const entries: HnEntry[] = []

    const walk = (list: HnComment[], depth: number) => {
        for (const comment of list) {
            entries.push({comment, depth})
            walk(comment.children, depth + 1)
        }
    }

    walk(comments, 0)
    return entries
}

export function visibleHnEntries(
    entries: HnEntry[],
    collapsed: ReadonlySet<number>
): HnEntry[] {
    const visible: HnEntry[] = []
    const hiddenDepths: number[] = []

    for (const entry of entries) {
        while (
            hiddenDepths.length > 0 &&
            hiddenDepths[hiddenDepths.length - 1] >= entry.depth
        ) {
            hiddenDepths.pop()
        }
        if (hiddenDepths.length > 0) continue

        visible.push(entry)
        if (collapsed.has(entry.comment.id) && entry.comment.children.length > 0) {
            hiddenDepths.push(entry.depth)
        }
    }

    return visible
}

export interface FetchHnThreadOptions {
    signal?: AbortSignal
    fetchImpl?: typeof fetch
}

export async function fetchHnThread(
    itemId: number,
    options: FetchHnThreadOptions = {}
): Promise<HnThread> {
    const {signal, fetchImpl = fetch} = options
    const response = await fetchImpl(`${HN_API_URL}/${itemId}`, {
        headers: {Accept: 'application/json'},
        signal
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const thread = parseHnThread(await response.json())
    if (!thread) throw new Error('Invalid discussion')
    return thread
}
