import {describe, expect, it} from 'vitest'
import {normalizeFeedUrl} from '../../src/background/messages'

describe('feed form URL validation', () => {
  it('accepts and trims http(s) URLs', () => {
    expect(normalizeFeedUrl(' https://example.com/feed.xml ')).toBe(
      'https://example.com/feed.xml'
    )
    expect(normalizeFeedUrl('http://example.com/rss')).toBe('http://example.com/rss')
  })

  it('rejects empty, relative and non-http schemes', () => {
    for (const value of ['', '   ', 'example.com/feed', 'file:///tmp/feed.xml']) {
      expect(() => normalizeFeedUrl(value)).toThrow('Enter a valid http(s) feed URL')
    }
    expect(() => normalizeFeedUrl('javascript:alert(1)')).toThrow(
      'Enter a valid http(s) feed URL'
    )
  })
})
