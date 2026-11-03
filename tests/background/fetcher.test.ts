import {afterEach, describe, expect, it, vi} from 'vitest'
import {fetchFeed} from '../../src/background/fetcher'

const input = {
  url: 'https://example.com/feed.xml',
  etag: '"abc"',
  lastModified: 'Tue, 03 Nov 2026 10:00:00 GMT'
}

function headersOf(init: RequestInit | undefined): Headers {
  return new Headers(init?.headers)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('fetchFeed', () => {
  it('returns the body and validators for a 200 response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response('<rss>ok</rss>', {
        status: 200,
        headers: {etag: '"v2"', 'last-modified': 'Wed, 04 Nov 2026 10:00:00 GMT'}
      })
    )

    const result = await fetchFeed(input, fetchImpl)

    expect(result).toEqual({
      status: 'ok',
      finalUrl: input.url,
      text: '<rss>ok</rss>',
      etag: '"v2"',
      lastModified: 'Wed, 04 Nov 2026 10:00:00 GMT'
    })

    const init = fetchImpl.mock.calls[0][1]
    expect(fetchImpl.mock.calls[0][0]).toBe(input.url)
    expect(headersOf(init).get('If-None-Match')).toBe('"abc"')
    expect(headersOf(init).get('If-Modified-Since')).toBe(input.lastModified)
  })

  it('omits conditional headers when no validators are stored', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('ok', {status: 200}))

    await fetchFeed({url: input.url, etag: null, lastModified: null}, fetchImpl)

    const headers = headersOf(fetchImpl.mock.calls[0][1])
    expect(headers.has('If-None-Match')).toBe(false)
    expect(headers.has('If-Modified-Since')).toBe(false)
  })

  it('returns not-modified for a 304 response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, {status: 304}))

    await expect(fetchFeed(input, fetchImpl)).resolves.toEqual({
      status: 'not-modified',
      finalUrl: input.url,
      etag: '"abc"',
      lastModified: input.lastModified
    })
  })

  it('returns an error for a 500 response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('nope', {status: 500}))

    await expect(fetchFeed(input, fetchImpl)).resolves.toEqual({
      status: 'error',
      error: 'HTTP 500'
    })
  })

  it('returns an error when the network request rejects', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error('offline')
    })

    await expect(fetchFeed(input, fetchImpl)).resolves.toEqual({
      status: 'error',
      error: 'offline'
    })
  })

  it('times out after the configured timeout', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )

    const pending = fetchFeed(input, fetchImpl, 20_000)
    await vi.advanceTimersByTimeAsync(20_000)

    await expect(pending).resolves.toEqual({
      status: 'error',
      error: 'Request timed out'
    })
  })

  it('rejects a response over 5 MB', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response('small', {
        status: 200,
        headers: {'content-length': String(5 * 1024 * 1024 + 1)}
      })
    )

    await expect(fetchFeed(input, fetchImpl)).resolves.toEqual({
      status: 'error',
      error: 'Feed is larger than 5 MB'
    })
  })
})
