import {type AnyFeed, parseFeed} from 'feedsmith'
import {excerptText, plainText} from './html'

export interface ParsedPost {
    guid: string | null
    title: string
    link: string | null
    publishedAt: number
    contentHtml: string | null
    excerpt: string
    imageUrl: string | null
    author: string | null
}

export interface ParsedFeed {
    title: string
    siteUrl: string | null
    description: string | null
    imageUrl: string | null
    items: ParsedPost[]
}

interface Link {
    href?: string
    rel?: string
}

interface Media {
    enclosures?: Array<{ url?: string; type?: string }>
    media?: {
        thumbnails?: Array<{ url?: string }>
        contents?: Array<{ url?: string; medium?: string; type?: string }>
    }
}

function timestamp(value: string | undefined | null): number {
    if (!value) return 0
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function alternateLink(links: Link[] | undefined): string | null {
    return (
        links?.find((link) => !link.rel || link.rel === 'alternate')?.href ??
        links?.[0]?.href ??
        null
    )
}

function imageFromItem(item: Media): string | null {
    const enclosure = item.enclosures?.find((entry) => entry.type?.startsWith('image/'))
    const thumbnail = item.media?.thumbnails?.[0]
    const content = item.media?.contents?.find(
        (entry) => entry.medium === 'image' || entry.type?.startsWith('image/')
    )

    return enclosure?.url ?? thumbnail?.url ?? content?.url ?? null
}

function parseRss(feed: Extract<AnyFeed, { format: 'rss' }>['feed']): ParsedFeed {
    return {
        title: feed.title ?? 'Untitled feed',
        siteUrl: feed.link ?? alternateLink(feed.atom?.links),
        description: feed.description ?? feed.atom?.subtitle?.value ?? null,
        imageUrl: feed.image?.url ?? feed.atom?.icon ?? null,
        items: (feed.items ?? []).map((item) => {
            const contentHtml =
                item.content?.encoded ??
                item.description ??
                item.atom?.content?.value ??
                null
            const excerptSource = item.description ?? item.atom?.summary?.value ?? contentHtml

            return {
                guid: item.guid?.value ?? null,
                title: item.title ?? 'Untitled',
                link: item.link ?? alternateLink(item.atom?.links),
                publishedAt: timestamp(
                    item.pubDate ?? item.dc?.dates?.[0] ?? item.atom?.published ?? item.atom?.updated
                ),
                contentHtml,
                excerpt: excerptSource ? excerptText(excerptSource) : '',
                imageUrl: imageFromItem(item),
                author:
                    item.authors?.[0]?.name ??
                    item.atom?.authors?.[0]?.name ??
                    item.dc?.creators?.[0] ??
                    null
            }
        })
    }
}

function parseAtom(feed: Extract<AnyFeed, { format: 'atom' }>['feed']): ParsedFeed {
    return {
        title: feed.title?.value ?? 'Untitled feed',
        siteUrl: alternateLink(feed.links),
        description: feed.subtitle?.value ?? null,
        imageUrl: feed.icon ?? feed.logo ?? null,
        items: (feed.entries ?? []).map((entry) => {
            const contentHtml = entry.content?.value ?? entry.summary?.value ?? null
            const excerptSource = entry.summary?.value ?? contentHtml

            return {
                guid: entry.id || null,
                title: entry.title?.value || 'Untitled',
                link: alternateLink(entry.links),
                publishedAt: timestamp(entry.published ?? entry.updated),
                contentHtml,
                excerpt: excerptSource ? excerptText(excerptSource) : '',
                imageUrl: imageFromItem(entry),
                author: entry.authors?.[0]?.name ?? null
            }
        })
    }
}

function parseJson(feed: Extract<AnyFeed, { format: 'json' }>['feed']): ParsedFeed {
    return {
        title: feed.title ?? 'Untitled feed',
        siteUrl: feed.home_page_url ?? null,
        description: feed.description ?? null,
        imageUrl: feed.icon ?? feed.favicon ?? null,
        items: (feed.items ?? []).map((item) => {
            const contentHtml = item.content_html ?? item.content_text ?? null
            const excerptSource = item.summary ?? item.content_text ?? contentHtml

            return {
                guid: item.id || null,
                title: item.title ?? 'Untitled',
                link: item.url ?? item.external_url ?? null,
                publishedAt: timestamp(item.date_published ?? item.date_modified),
                contentHtml,
                excerpt: excerptSource ? excerptText(excerptSource) : '',
                imageUrl: item.image ?? item.banner_image ?? null,
                author: item.authors?.[0]?.name ?? null
            }
        })
    }
}

function parseRdf(feed: Extract<AnyFeed, { format: 'rdf' }>['feed']): ParsedFeed {
    return {
        title: feed.title ?? 'Untitled feed',
        siteUrl: feed.link ?? alternateLink(feed.atom?.links),
        description: feed.description ?? feed.atom?.subtitle?.value ?? null,
        imageUrl: feed.image?.url ?? feed.atom?.icon ?? null,
        items: (feed.items ?? []).map((item) => {
            const contentHtml =
                item.content?.encoded ??
                item.description ??
                item.atom?.content?.value ??
                null
            const excerptSource = item.description ?? item.atom?.summary?.value ?? contentHtml

            return {
                guid: null,
                title: item.title ?? 'Untitled',
                link: item.link ?? item.rdf?.about ?? null,
                publishedAt: timestamp(
                    item.dc?.dates?.[0] ?? item.atom?.published ?? item.atom?.updated
                ),
                contentHtml,
                excerpt: excerptSource ? excerptText(excerptSource) : '',
                imageUrl: imageFromItem(item),
                author: item.dc?.creators?.[0] ?? item.atom?.authors?.[0]?.name ?? null
            }
        })
    }
}

export function parseFeedDocument(text: string): ParsedFeed {
    let parsed: AnyFeed

    try {
        parsed = parseFeed(text)
    } catch {
        throw new Error('Unrecognized feed format')
    }

    switch (parsed.format) {
        case 'rss':
            return parseRss(parsed.feed)
        case 'atom':
            return parseAtom(parsed.feed)
        case 'json':
            return parseJson(parsed.feed)
        case 'rdf':
            return parseRdf(parsed.feed)
    }
}

export {plainText}
