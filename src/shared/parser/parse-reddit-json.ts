import type {ContentFormat} from '../model/post'
import type {ParsedFeed, ParsedPost} from './parse-feed'
import {decodeEntities, excerptText, plainText} from './html'

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(record: Record<string, unknown>, key: string): string | null {
    const value = record[key]
    return typeof value === 'string' && value.trim() ? value : null
}

function numberValue(record: Record<string, unknown>, key: string): number | null {
    const value = record[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function httpUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null

    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
    } catch {
        return null
    }
}

function absoluteRedditUrl(value: string | null): string | null {
    if (!value) return null

    try {
        return new URL(value, 'https://www.reddit.com').href
    } catch {
        return null
    }
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        switch (character) {
            case '&':
                return '&amp;'
            case '<':
                return '&lt;'
            case '>':
                return '&gt;'
            case '"':
                return '&quot;'
            default:
                return '&#39;'
        }
    })
}

function httpsUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null

    try {
        const url = new URL(value)
        return url.protocol === 'https:' ? url.href : null
    } catch {
        return null
    }
}

function decodedHttpsUrl(value: unknown): string | null {
    return typeof value === 'string' ? httpsUrl(plainText(value)) : null
}

function previewSourceUrl(data: Record<string, unknown>): string | null {
    const preview = isRecord(data.preview) ? data.preview : null
    const images = Array.isArray(preview?.images) ? preview.images : []
    const first = images.find(isRecord)
    const source = first && isRecord(first.source) ? first.source : null
    return source ? decodedHttpsUrl(source.url) : null
}

function previewImage(data: Record<string, unknown>): string | null {
    const preview = previewSourceUrl(data)
    if (preview) return preview

    const thumbnail = decodedHttpsUrl(data.thumbnail) ?? httpUrl(data.thumbnail)
    if (thumbnail) return thumbnail

    return data.post_hint === 'image' ? httpUrl(data.url) : null
}

function directImage(value: unknown): string | null {
    const url = decodedHttpsUrl(value)
    if (!url) return null

    return /\.(gif|png|jpe?g|webp|avif)$/i.test(new URL(url).pathname) ? url : null
}

function directVideo(value: unknown): string | null {
    const url = decodedHttpsUrl(value)
    if (!url) return null

    return /\.(mp4|webm|ogg)$/i.test(new URL(url).pathname) ? url : null
}

function mediaLink(url: string): string {
    const escaped = escapeHtml(url)
    return `<p><a href="${escaped}">${escaped}</a></p>`
}

function redditVideoUrl(data: Record<string, unknown>): string | null {
    const media = isRecord(data.secure_media)
        ? data.secure_media
        : isRecord(data.media)
            ? data.media
            : null
    const video = media && isRecord(media.reddit_video) ? media.reddit_video : null
    return video ? decodedHttpsUrl(video.fallback_url) : null
}

function galleryUrls(data: Record<string, unknown>): string[] {
    const metadata = isRecord(data.media_metadata) ? data.media_metadata : null
    if (!metadata) return []

    const urls: string[] = []
    for (const value of Object.values(metadata)) {
        if (!isRecord(value)) continue

        const source = isRecord(value.s) ? value.s : null
        const full = source ? decodedHttpsUrl(source.u) : null
        const previews = Array.isArray(value.p) ? value.p : []
        const last = previews.filter(isRecord).at(-1)
        const preview = last ? decodedHttpsUrl(last.u) : null
        const url = full ?? preview

        if (url && !urls.includes(url)) urls.push(url)
        if (urls.length >= 20) break
    }

    return urls
}

function mediaContent(data: Record<string, unknown>): string | null {
    const video = redditVideoUrl(data)
    if (video) return mediaLink(video)

    if (data.is_gallery === true) {
        const images = galleryUrls(data)
        if (images.length) return images.map(mediaLink).join('')
    }

    if (data.post_hint === 'image') {
        const image = previewSourceUrl(data)
        if (image) return mediaLink(image)
    }

    const image = directImage(data.url_overridden_by_dest) ?? directImage(data.url)
    if (image) return mediaLink(image)

    const videoUrl = directVideo(data.url_overridden_by_dest) ?? directVideo(data.url)
    if (videoUrl) return mediaLink(videoUrl)

    if (data.is_gallery === true) {
        const fallback = previewImage(data)
        if (fallback) return mediaLink(fallback)
    }

    return null
}

function crosspostParent(data: Record<string, unknown>): Record<string, unknown> | null {
    const parents = data.crosspost_parent_list
    if (!Array.isArray(parents)) return null

    for (const parent of parents) {
        if (!isRecord(parent)) continue
        return isRecord(parent.data) ? parent.data : parent
    }

    return null
}

function selftextContent(data: Record<string, unknown>): {
    html: string | null
    text: string | null
    excerpt: string
} {
    const text = stringValue(data, 'selftext')
    const rawHtml = stringValue(data, 'selftext_html')
    const html = rawHtml
        ? decodeEntities(rawHtml)
            .replace(/<!--\s*SC_(?:OFF|ON)\s*-->/g, '')
            .trim()
        : null

    return {
        html: html || null,
        text,
        excerpt: html ? excerptText(html) : text ? excerptText(text) : ''
    }
}

function textHtml(text: string): string {
    return text
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
        .join('')
}

function contentFor(
    data: Record<string, unknown>,
    permalink: string | null
): {contentHtml: string | null; contentType?: ContentFormat; excerpt: string} {
    const selftext = selftextContent(data)
    const parent = crosspostParent(data)
    const media = mediaContent(data) ?? (parent ? mediaContent(parent) : null)
    const external = httpUrl(data.url_overridden_by_dest) ?? httpUrl(data.url)
    const link = external && external !== permalink ? external : null

    if (media) {
        const parts = [media]
        if (selftext.html) parts.push(selftext.html)
        else if (selftext.text) parts.push(textHtml(selftext.text))

        return {
            contentHtml: parts.join(''),
            contentType: 'html',
            excerpt: selftext.excerpt
        }
    }

    if (selftext.html) {
        return {
            contentHtml:
                link && data.is_self !== true
                    ? `${mediaLink(link)}${selftext.html}`
                    : selftext.html,
            contentType: 'html',
            excerpt: selftext.excerpt
        }
    }

    if (selftext.text) {
        if (link && data.is_self !== true) {
            return {
                contentHtml: `${mediaLink(link)}${textHtml(selftext.text)}`,
                contentType: 'html',
                excerpt: selftext.excerpt
            }
        }

        return {
            contentHtml: selftext.text,
            contentType: 'text',
            excerpt: selftext.excerpt
        }
    }

    if (link) {
        return {
            contentHtml: mediaLink(link),
            contentType: 'html',
            excerpt: link
        }
    }

    return {contentHtml: null, excerpt: ''}
}

function postFromChild(child: Record<string, unknown>): ParsedPost | null {
    if (child.kind !== 't3' || !isRecord(child.data)) return null

    const data = child.data
    const permalink = absoluteRedditUrl(stringValue(data, 'permalink'))
    const external = httpUrl(data.url_overridden_by_dest) ?? httpUrl(data.url)
    const created = numberValue(data, 'created_utc')
    const parent = crosspostParent(data)
    const content = contentFor(data, permalink)

    return {
        guid: stringValue(data, 'name') ?? stringValue(data, 'id'),
        title: stringValue(data, 'title') ?? 'Untitled',
        link: permalink ?? external,
        publishedAt: created !== null ? created * 1_000 : 0,
        contentHtml: content.contentHtml,
        contentType: content.contentType,
        excerpt: content.excerpt,
        imageUrl: previewImage(data) ?? (parent ? previewImage(parent) : null),
        author: stringValue(data, 'author')
    }
}

export function parseRedditListing(text: string): ParsedFeed | null {
    const trimmed = text.trimStart()
    if (!trimmed.startsWith('{')) return null

    let parsed: unknown
    try {
        parsed = JSON.parse(trimmed)
    } catch {
        return null
    }

    if (!isRecord(parsed) || parsed.kind !== 'Listing' || !isRecord(parsed.data)) {
        return null
    }

    const children = parsed.data.children
    if (!Array.isArray(children)) return null

    const posts: ParsedPost[] = []
    const subreddits: string[] = []

    for (const child of children) {
        if (!isRecord(child)) continue

        if (child.kind === 't3' && isRecord(child.data)) {
            const subreddit = stringValue(child.data, 'subreddit')
            if (subreddit) subreddits.push(subreddit)
        }

        const post = postFromChild(child)
        if (post) posts.push(post)
    }

    const firstSubreddit = subreddits[0]
    const singleSubreddit =
        firstSubreddit !== undefined &&
        subreddits.every((subreddit) => subreddit === firstSubreddit)
            ? firstSubreddit
            : null

    return {
        title: singleSubreddit ? `r/${singleSubreddit}` : 'Reddit',
        siteUrl: singleSubreddit
            ? `https://www.reddit.com/r/${encodeURIComponent(singleSubreddit)}/`
            : 'https://www.reddit.com/',
        description: null,
        imageUrl: null,
        items: posts
    }
}
