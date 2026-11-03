import {plainText} from '../parser/html'

export {plainText}

export function formatRelativeTime(date: Date, now = Date.now()): string {
    const elapsed = Math.max(0, now - date.getTime())
    const minutes = Math.floor(elapsed / 60_000)

    if (minutes < 1) return 'now'
    if (minutes < 60) return `${minutes}m ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`

    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`

    return new Intl.DateTimeFormat('en', {month: 'short', day: 'numeric'}).format(date)
}
