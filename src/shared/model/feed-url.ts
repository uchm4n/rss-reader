export function canonicalFeedUrl(raw: string): string {
    const value = raw.trim()

    try {
        const url = new URL(value)
        url.hash = ''
        if (url.pathname.length > 1) {
            url.pathname = url.pathname.replace(/\/+$/, '')
        }
        return url.toString()
    } catch {
        return value
    }
}

export function isRedditFeedUrl(raw: string | null | undefined): boolean {
    if (!raw) return false

    try {
        const host = new URL(raw).hostname.toLowerCase()
        return host === 'reddit.com' || host === 'www.reddit.com'
    } catch {
        return false
    }
}

export function redditVideoAudioUrl(raw: string): string | null {
    try {
        const url = new URL(raw)
        const host = url.hostname.toLowerCase()
        if (url.protocol !== 'https:') return null
        if (host !== 'v.redd.it' && !host.endsWith('.v.redd.it')) return null

        const match = /\/(CMAF|DASH)_\d+\.mp4$/i.exec(url.pathname)
        if (!match) return null

        const audio =
            match[1].toUpperCase() === 'CMAF'
                ? 'CMAF_AUDIO_128.mp4'
                : 'DASH_audio.mp4'
        url.pathname = url.pathname.replace(/[^/]+$/, audio)
        url.search = ''
        url.hash = ''
        return url.href
    } catch {
        return null
    }
}
