import {describe, expect, it} from 'vitest'
import {
  BATCH_SIZE,
  MIN_INTERVAL_SECONDS,
  backoffSeconds,
  effectiveInterval,
  nextDueAt,
  selectDueFeeds
} from '../../src/background/scheduler'
import {feedFixture} from '../helpers/db'

describe('effectiveInterval', () => {
  it('uses the global interval when there is no override', () => {
    expect(effectiveInterval(feedFixture({refreshInterval: null}), 900)).toBe(900)
  })

  it('uses the per-feed override', () => {
    expect(effectiveInterval(feedFixture({refreshInterval: 120}), 900)).toBe(120)
  })

  it('clamps values below the Chrome alarm floor', () => {
    expect(MIN_INTERVAL_SECONDS).toBe(30)
    expect(effectiveInterval(feedFixture({refreshInterval: 10}), 900)).toBe(30)
    expect(effectiveInterval(feedFixture({refreshInterval: null}), 5)).toBe(30)
  })
})

describe('selectDueFeeds', () => {
  it('returns only due feeds ordered by next fetch time', () => {
    const feeds = [
      feedFixture({id: 'late', nextFetchAt: 1_000}),
      feedFixture({id: 'second', nextFetchAt: 200}),
      feedFixture({id: 'first', nextFetchAt: 100})
    ]

    expect(selectDueFeeds(feeds, 500, 10).map((feed) => feed.id)).toEqual([
      'first',
      'second'
    ])
  })

  it('limits the batch', () => {
    const feeds = Array.from({length: 5}, (_, index) =>
      feedFixture({id: `feed-${index}`, nextFetchAt: index})
    )

    const selected = selectDueFeeds(feeds, 1_000, BATCH_SIZE)
    expect(selected).toHaveLength(BATCH_SIZE)
    expect(selected.map((feed) => feed.id)).toEqual(['feed-0', 'feed-1', 'feed-2'])
  })
})

describe('nextDueAt', () => {
  it('returns the earliest next fetch time', () => {
    const feeds = [
      feedFixture({id: 'a', nextFetchAt: 900}),
      feedFixture({id: 'b', nextFetchAt: 100})
    ]

    expect(nextDueAt(feeds, 500)).toBe(100)
  })

  it('returns null when there are no feeds', () => {
    expect(nextDueAt([], 500)).toBeNull()
  })
})

describe('backoffSeconds', () => {
  it('doubles on each error', () => {
    expect(backoffSeconds(900, 0)).toBe(900)
    expect(backoffSeconds(900, 1)).toBe(1_800)
    expect(backoffSeconds(900, 2)).toBe(3_600)
  })

  it('caps the backoff at one hour', () => {
    expect(backoffSeconds(900, 3)).toBe(3_600)
    expect(backoffSeconds(30, 20)).toBe(3_600)
  })
})
