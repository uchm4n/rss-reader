import type {Feed} from '../db/types'

export const ALARM_NAME = 'rss-reader-refresh'
export const MIN_INTERVAL_SECONDS = 30
export const BATCH_SIZE = 3
export const MAX_BACKOFF_SECONDS = 3_600
export const WORK_BUDGET_MS = 4 * 60_000

export function effectiveInterval(feed: Feed, globalSeconds: number): number {
    const seconds = feed.refreshInterval ?? globalSeconds
    return Math.max(MIN_INTERVAL_SECONDS, Math.trunc(seconds))
}

export function selectDueFeeds(feeds: Feed[], now: number, limit: number): Feed[] {
    return feeds
        .filter((feed) => feed.nextFetchAt <= now)
        .sort((left, right) => left.nextFetchAt - right.nextFetchAt)
        .slice(0, Math.max(0, limit))
}

export function nextDueAt(feeds: Feed[], _now: number): number | null {
    if (!feeds.length) return null
    return Math.min(...feeds.map((feed) => feed.nextFetchAt))
}

export function backoffSeconds(interval: number, errorCount: number): number {
    if (errorCount <= 0) return Math.max(MIN_INTERVAL_SECONDS, interval)
    const backoff = interval * 2 ** Math.min(errorCount, 16)
    return Math.min(MAX_BACKOFF_SECONDS, Math.max(MIN_INTERVAL_SECONDS, Math.trunc(backoff)))
}
