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
