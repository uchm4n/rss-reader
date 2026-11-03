import {describe, expect, it} from 'vitest'
import {canonicalFeedUrl} from '../../src/shared/model/feed-url'

describe('canonicalFeedUrl', () => {
    it('ignores fragments and trailing slashes', () => {
        expect(canonicalFeedUrl('https://example.com/feed/#latest')).toBe(
            'https://example.com/feed'
        )
        expect(canonicalFeedUrl('https://example.com/feed/')).toBe(
            'https://example.com/feed'
        )
    })

    it('keeps the root path stable', () => {
        expect(canonicalFeedUrl('https://example.com/')).toBe('https://example.com/')
    })

    it('returns trimmed input when it cannot parse', () => {
        expect(canonicalFeedUrl(' not a url ')).toBe('not a url')
    })
})
