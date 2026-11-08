export interface SafeEmbed {
    provider: string
    url: string
    mode: 'iframe' | 'link'
    pageUrl: string | null
    thumbnailUrl: string | null
    aspectRatio: number
    forceAspectRatio?: boolean
}

interface BuiltEmbed {
    url: string
    mode?: 'iframe' | 'link'
    pageUrl?: string
    thumbnailUrl?: string
    aspectRatio?: number
}

interface EmbedProvider {
    name: string
    hosts: string[]
    aspectRatio: number
    forceAspectRatio?: boolean
    build: (url: URL) => BuiltEmbed | null
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,}$/
const VIMEO_ID = /^\d{6,}$/
const DAILYMOTION_ID = /^[A-Za-z0-9]+$/
const TIKTOK_ID = /^\d{6,}$/
const INSTAGRAM_CODE = /^[A-Za-z0-9_-]+$/

function parseHttpsUrl(raw: string | null): URL | null {
    if (!raw) return null

    try {
        const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
        return url.protocol === 'https:' ? url : null
    } catch {
        return null
    }
}

function bareHost(url: URL): string {
    return url.hostname.toLowerCase().replace(/^www\./, '')
}

function youtubeVideo(id: string): BuiltEmbed {
    return {
        url: `https://www.youtube-nocookie.com/embed/${id}`,
        mode: 'link',
        pageUrl: `https://www.youtube.com/watch?v=${id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    }
}

function youtubePlaylist(list: string): BuiltEmbed {
    return {
        url: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`,
        mode: 'link',
        pageUrl: `https://www.youtube.com/playlist?list=${list}`
    }
}

function buildYouTube(url: URL): BuiltEmbed | null {
    const host = bareHost(url)
    if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0]
        return id && YOUTUBE_ID.test(id) ? youtubeVideo(id) : null
    }

    if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtube-nocookie.com') {
        return null
    }

    const segments = url.pathname.split('/').filter(Boolean)
    if (segments[0] === 'watch') {
        const id = url.searchParams.get('v')
        return id && YOUTUBE_ID.test(id) ? youtubeVideo(id) : null
    }

    if (segments[0] === 'embed' && segments[1] === 'videoseries') {
        const list = url.searchParams.get('list')
        return list && YOUTUBE_ID.test(list) ? youtubePlaylist(list) : null
    }

    if (segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'live') {
        const id = segments[1]
        return id && YOUTUBE_ID.test(id) ? youtubeVideo(id) : null
    }

    if (segments[0] === 'playlist') {
        const list = url.searchParams.get('list')
        return list && YOUTUBE_ID.test(list) ? youtubePlaylist(list) : null
    }

    return null
}

function buildVimeo(url: URL): BuiltEmbed | null {
    const host = bareHost(url)
    if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null

    const id = url.pathname.match(/\d{6,}/g)?.at(-1)
    if (!id || !VIMEO_ID.test(id)) return null

    const embed = new URL(`https://player.vimeo.com/video/${id}`)
    const hash = url.searchParams.get('h')
    if (hash && /^[A-Za-z0-9]+$/.test(hash)) {
        embed.searchParams.set('h', hash)
    }

    return {url: embed.toString()}
}

function buildDailymotion(url: URL): BuiltEmbed | null {
    const host = bareHost(url)
    if (host !== 'dailymotion.com' && host !== 'dai.ly') return null

    const segments = url.pathname.split('/').filter(Boolean)
    const id = host === 'dai.ly' ? segments[0] : segments.at(-1)
    if (!id || !DAILYMOTION_ID.test(id)) return null

    return {url: `https://www.dailymotion.com/embed/video/${id}`}
}

function buildReddit(url: URL): BuiltEmbed | null {
    const media = url.pathname.match(/^\/mediaembed\/([a-z0-9]{5,})\/?$/i)
    if (media) {
        return {
            url: `https://www.reddit.com/mediaembed/${media[1]}`,
            aspectRatio: 4 / 3
        }
    }

    if (!/^\/r\/[^/]+\/comments\/[^/]+(?:\/.*)?$/.test(url.pathname)) {
        return null
    }

    const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
    return {
        url: `https://www.redditmedia.com${path}?ref_source=embed&ref=share&embed=true`
    }
}

function buildTikTok(url: URL): BuiltEmbed | null {
    const segments = url.pathname.split('/').filter(Boolean)
    let id: string | undefined

    if (segments[0] === 'embed' && segments[1] === 'v2') {
        id = segments[2]
    } else if (segments[0] === 'embed') {
        id = segments[1]
    } else if (segments[0] === 'player' && segments[1] === 'v1') {
        id = segments[2]
    } else {
        const videoIndex = segments.indexOf('video')
        if (videoIndex >= 0) id = segments[videoIndex + 1]
    }

    if (!id || !TIKTOK_ID.test(id)) return null
    return {url: `https://www.tiktok.com/player/v1/${id}`}
}

function buildInstagram(url: URL): BuiltEmbed | null {
    const segments = url.pathname.split('/').filter(Boolean)
    const type = segments[0]
    if (type !== 'p' && type !== 'reel' && type !== 'tv') return null

    const shortcode = segments[1]
    if (!shortcode || !INSTAGRAM_CODE.test(shortcode)) return null

    return {url: `https://www.instagram.com/${type}/${shortcode}/embed/`}
}

function facebookPlugin(kind: 'video' | 'post', target: URL): string {
    const params = new URLSearchParams({href: target.toString()})
    if (kind === 'video') params.set('show_text', 'false')
    return `https://www.facebook.com/plugins/${kind}.php?${params.toString()}`
}

function isFacebookTarget(url: URL): boolean {
    const host = bareHost(url)
    return (
        host === 'facebook.com' ||
        host === 'm.facebook.com' ||
        host === 'web.facebook.com' ||
        host === 'fb.watch'
    )
}

function buildFacebook(url: URL): BuiltEmbed | null {
    const host = bareHost(url)
    if (!isFacebookTarget(url)) return null

    if (url.pathname === '/plugins/video.php' || url.pathname === '/plugins/post.php') {
        const href = url.searchParams.get('href')
        if (!href) return null

        let target: URL
        try {
            target = new URL(href)
        } catch {
            return null
        }
        if (target.protocol !== 'https:' || !isFacebookTarget(target)) return null

        const kind = url.pathname === '/plugins/video.php' ? 'video' : 'post'
        return {
            url: facebookPlugin(kind, target),
            aspectRatio: kind === 'video' ? 16 / 9 : 4 / 5
        }
    }

    if (host === 'fb.watch') {
        return {url: facebookPlugin('video', url), aspectRatio: 16 / 9}
    }

    const path = url.pathname.toLowerCase()
    const video =
        path.includes('/videos/') ||
        path.includes('/reel/') ||
        path.includes('/watch') ||
        path === '/video.php'
    const post =
        path.includes('/posts/') ||
        path === '/permalink.php' ||
        path === '/photo.php' ||
        path === '/story.php'

    if (!video && !post) return null

    const kind = video ? 'video' : 'post'
    return {
        url: facebookPlugin(kind, url),
        aspectRatio: kind === 'video' ? 16 / 9 : 4 / 5
    }
}

const PROVIDERS: Record<string, EmbedProvider> = {
    youtube: {
        name: 'YouTube',
        hosts: ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'youtu.be'],
        aspectRatio: 16 / 9,
        build: buildYouTube
    },
    vimeo: {
        name: 'Vimeo',
        hosts: ['vimeo.com', 'player.vimeo.com'],
        aspectRatio: 16 / 9,
        build: buildVimeo
    },
    dailymotion: {
        name: 'Dailymotion',
        hosts: ['dailymotion.com', 'dai.ly'],
        aspectRatio: 16 / 9,
        build: buildDailymotion
    },
    reddit: {
        name: 'Reddit',
        hosts: ['reddit.com', 'm.reddit.com', 'old.reddit.com', 'redditmedia.com'],
        aspectRatio: 4 / 3,
        forceAspectRatio: true,
        build: buildReddit
    },
    tiktok: {
        name: 'TikTok',
        hosts: ['tiktok.com', 'm.tiktok.com'],
        aspectRatio: 9 / 16,
        forceAspectRatio: true,
        build: buildTikTok
    },
    instagram: {
        name: 'Instagram',
        hosts: ['instagram.com'],
        aspectRatio: 4 / 5,
        forceAspectRatio: true,
        build: buildInstagram
    },
    facebook: {
        name: 'Facebook',
        hosts: ['facebook.com', 'm.facebook.com', 'web.facebook.com', 'fb.watch'],
        aspectRatio: 16 / 9,
        forceAspectRatio: true,
        build: buildFacebook
    }
}

const PROVIDERS_BY_HOST = new Map(
    Object.values(PROVIDERS).flatMap((provider) =>
        provider.hosts.map((host) => [host, provider] as const)
    )
)

export function normalizeEmbedUrl(raw: string | null): SafeEmbed | null {
    const url = parseHttpsUrl(raw)
    if (!url) return null

    const provider = PROVIDERS_BY_HOST.get(bareHost(url))
    if (!provider) return null

    const built = provider.build(url)
    if (!built) return null

    return {
        provider: provider.name,
        url: built.url,
        mode: built.mode ?? 'iframe',
        pageUrl: built.pageUrl ?? null,
        thumbnailUrl: built.thumbnailUrl ?? null,
        aspectRatio: built.aspectRatio ?? provider.aspectRatio,
        forceAspectRatio: provider.forceAspectRatio
    }
}
