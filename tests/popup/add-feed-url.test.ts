import {describe, expect, it} from 'vitest'
import type {DiscoveryResult} from '../../src/background/discovery'
import {firstAddableFeedUrl} from '../../src/popup/lib/discovery'

function discovery(feeds: Array<{url: string; subscribed: boolean}>): DiscoveryResult {
  return {
    tabId: 1,
    pageUrl: 'https://example.com/',
    feeds: feeds.map((feed, index) => ({
      url: feed.url,
      title: `Feed ${index + 1}`,
      type: 'rss',
      source: 'link',
      subscribed: feed.subscribed
    }))
  }
}

describe('firstAddableFeedUrl', () => {
  it('returns an empty string when discovery is unavailable', () => {
    expect(firstAddableFeedUrl(null)).toBe('')
  })

  it('returns an empty string when nothing was detected', () => {
    expect(firstAddableFeedUrl(discovery([]))).toBe('')
  })

  it('returns an empty string when every detected feed is subscribed', () => {
    expect(
      firstAddableFeedUrl(
        discovery([
          {url: 'https://example.com/one.xml', subscribed: true},
          {url: 'https://example.com/two.xml', subscribed: true}
        ])
      )
    ).toBe('')
  })

  it('returns the first unsubscribed feed', () => {
    expect(
      firstAddableFeedUrl(
        discovery([
          {url: 'https://example.com/one.xml', subscribed: true},
          {url: 'https://example.com/two.xml', subscribed: false},
          {url: 'https://example.com/three.xml', subscribed: false}
        ])
      )
    ).toBe('https://example.com/two.xml')
  })
})
