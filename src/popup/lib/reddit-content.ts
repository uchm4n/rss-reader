export type RedditCardKind = 'video' | 'image' | 'link' | 'self' | 'gallery'

export interface RedditCard {
    kind: RedditCardKind
    postId: string
    postUrl: string
    author: string | null
    summaryHtml: string | null
    thumbnailUrl: string | null
    imageUrl: string | null
    outboundUrl: string | null
}

interface RedditPostRef {
    postId: string
    postUrl: string
}

const REDDIT_HOSTS = new Set([
    'reddit.com',
    'www.reddit.com',
    'old.reddit.com',
    'm.reddit.com'
])

const REDDIT_IMAGE_HOSTS = new Set([
    'i.redd.it',
    'preview.redd.it',
    'external-preview.redd.it'
])

function parseUrl(raw: string | null): URL | null {
    if (!raw) return null

    try {
        return new URL(raw.startsWith('//') ? `https:${raw}` : raw)
    } catch {
        return null
    }
}

function httpsUrl(raw: string | null): string | null {
    const url = parseUrl(raw)
    return url?.protocol === 'https:' ? url.toString() : null
}

function httpUrl(raw: string | null): string | null {
    const url = parseUrl(raw)
    return url && (url.protocol === 'http:' || url.protocol === 'https:')
        ? url.toString()
        : null
}

function redditPostRef(raw: string | null): RedditPostRef | null {
    const url = parseUrl(raw)
    if (!url || url.protocol !== 'https:') return null
    if (!REDDIT_HOSTS.has(url.hostname.toLowerCase())) return null

    const segments = url.pathname.split('/').filter(Boolean)
    const commentsIndex = segments.indexOf('comments')
    if (commentsIndex < 0) return null

    const postId = segments[commentsIndex + 1]
    if (!postId || !/^[a-z0-9]{5,}$/i.test(postId)) return null
    if (segments.length > commentsIndex + 3) return null

    const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
    return {postId, postUrl: `https://www.reddit.com${path}`}
}

export function redditPostId(post: {
    link: string | null
    contentHtml: string | null
}): string | null {
    if (post.contentHtml) {
        const doc = new DOMParser().parseFromString(post.contentHtml, 'text/html')
        for (const anchor of doc.querySelectorAll<HTMLAnchorElement>('a[href]')) {
            const ref = redditPostRef(anchor.getAttribute('href'))
            if (ref) return ref.postId
        }
    }

    return redditPostRef(post.link)?.postId ?? null
}

function outboundFor(
    raw: string | null,
    postId: string
): {url: string; kind: 'video' | 'image' | 'link' | 'gallery'} | null {
    const url = parseUrl(raw)
    if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
        return null
    }

    const post = redditPostRef(url.toString())
    if (post?.postId === postId) return null

    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const value = url.toString()

    if (REDDIT_HOSTS.has(url.hostname.toLowerCase())) {
        return url.pathname.startsWith('/gallery/')
            ? {url: value, kind: 'gallery'}
            : null
    }

    if (host === 'v.redd.it') return {url: value, kind: 'video'}
    if (REDDIT_IMAGE_HOSTS.has(host)) return {url: value, kind: 'image'}
    return {url: value, kind: 'link'}
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
    return escapeHtml(value).replace(/"/g, '&quot;')
}

function linkDomain(raw: string): string {
    try {
        return new URL(raw).hostname.replace(/^www\./, '')
    } catch {
        return 'Link'
    }
}

export function renderRedditCard(card: RedditCard): string {
    let media = ''

    if (card.kind === 'video') {
        const poster = card.thumbnailUrl
            ? `<img class="reddit-video-poster" src="${escapeAttr(card.thumbnailUrl)}" alt="">`
            : ''
        const mediaClass = card.thumbnailUrl
            ? 'reddit-media'
            : 'reddit-media reddit-media-square'
        media = `<div class="${mediaClass}">${poster}<iframe src="https://www.reddit.com/mediaembed/${escapeAttr(card.postId)}" title="Reddit video" loading="lazy"></iframe></div>`
    } else if (card.kind === 'image') {
        const image = card.imageUrl ?? card.thumbnailUrl
        if (image) {
            media = `<a class="reddit-image-link" href="${escapeAttr(image)}"><img class="reddit-image" src="${escapeAttr(image)}" alt=""></a>`
        }
    } else if (card.kind === 'gallery' && card.thumbnailUrl) {
        media = `<a class="reddit-image-link" href="${escapeAttr(card.outboundUrl ?? card.postUrl)}"><img class="reddit-image" src="${escapeAttr(card.thumbnailUrl)}" alt=""></a>`
    } else if (card.kind === 'link' && card.outboundUrl) {
        media = `<a class="reddit-link" href="${escapeAttr(card.outboundUrl)}">${
            card.thumbnailUrl
                ? `<img class="reddit-thumb" src="${escapeAttr(card.thumbnailUrl)}" alt="">`
                : ''
        }<span class="reddit-link-domain">${escapeHtml(linkDomain(card.outboundUrl))}</span></a>`
    }

    const summary = card.summaryHtml
        ? `<div class="reddit-summary">${card.summaryHtml}</div>`
        : ''
    const author = card.author
        ? `<span>u/${escapeHtml(card.author)}</span>`
        : ''

    return `<div class="reddit-card">${media}${summary}<div class="reddit-meta">${author}<a href="${escapeAttr(card.postUrl)}">View on Reddit</a></div></div>`
}

export function renderRedditContent(
    html: string,
    fallbackImageUrl?: string | null
): string | null {
    const card = parseRedditCard(html, fallbackImageUrl)
    return card ? renderRedditCard(card) : null
}

export function parseRedditCard(
    html: string,
    fallbackImageUrl?: string | null
): RedditCard | null {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    if (!doc.body.textContent?.includes('submitted by')) return null

    const anchors = [...doc.querySelectorAll<HTMLAnchorElement>('a[href]')]
    const posts = anchors
        .map((anchor) => ({
            anchor,
            post: redditPostRef(anchor.getAttribute('href'))
        }))
        .filter(
            (entry): entry is {anchor: HTMLAnchorElement; post: RedditPostRef} =>
                Boolean(entry.post)
        )

    const postEntry =
        posts.find((entry) => Boolean(entry.anchor.querySelector('img'))) ?? posts[0]
    if (!postEntry) return null

    const summaryHtml = doc.querySelector('div.md')?.innerHTML.trim() || null
    const thumbnailUrl = httpsUrl(
        postEntry.anchor.querySelector<HTMLImageElement>('img')?.getAttribute('src') ??
            doc.querySelector<HTMLImageElement>('table img')?.getAttribute('src') ??
            fallbackImageUrl ??
            null
    )

    const authorAnchor = anchors
        .filter((anchor) => {
            const url = parseUrl(anchor.getAttribute('href'))
            return (
                url !== null &&
                REDDIT_HOSTS.has(url.hostname.toLowerCase()) &&
                url.pathname.startsWith('/user/')
            )
        })
        .at(-1)
    const author =
        authorAnchor?.textContent?.trim().replace(/^\/?u\//i, '').trim() || null

    const linkAnchor = anchors.find(
        (anchor) => anchor.textContent?.trim() === '[link]'
    )
    const outbound =
        (linkAnchor && outboundFor(linkAnchor.getAttribute('href'), postEntry.post.postId)) ||
        anchors
            .map((anchor) => outboundFor(anchor.getAttribute('href'), postEntry.post.postId))
            .find((value) => value !== null) ||
        null

    const kind: RedditCardKind = outbound?.kind ?? 'self'

    return {
        kind,
        postId: postEntry.post.postId,
        postUrl: postEntry.post.postUrl,
        author,
        summaryHtml,
        thumbnailUrl,
        imageUrl: kind === 'image' ? outbound?.url ?? thumbnailUrl : null,
        outboundUrl: outbound?.url ?? null
    }
}
