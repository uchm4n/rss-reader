import {describe, expect, it} from 'vitest'
import {
    canonicalFeedUrl,
    isRedditFeedUrl,
    redditVideoAudioUrl
} from '../../src/shared/model/feed-url'

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

describe('isRedditFeedUrl', () => {
    it('accepts canonical Reddit feed hosts', () => {
        expect(isRedditFeedUrl('https://reddit.com/r/popular/.json')).toBe(true)
        expect(isRedditFeedUrl('https://www.reddit.com/r/popular/.json')).toBe(true)
    })

    it('rejects other Reddit hosts and lookalikes', () => {
        expect(isRedditFeedUrl('https://old.reddit.com/r/popular/.json')).toBe(false)
        expect(isRedditFeedUrl('https://reddit.com.evil.test/r/popular/.json')).toBe(false)
        expect(isRedditFeedUrl('https://example.com/feed.xml')).toBe(false)
        expect(isRedditFeedUrl(null)).toBe(false)
    })
})

describe('redditVideoAudioUrl', () => {
    it('derives the CMAF audio track from a fallback video URL', () => {
        expect(
            redditVideoAudioUrl('https://v.redd.it/abc/CMAF_1080.mp4?source=fallback')
        ).toBe('https://v.redd.it/abc/CMAF_AUDIO_128.mp4')
    })

    it('derives the DASH audio track from a fallback video URL', () => {
        expect(
            redditVideoAudioUrl('https://v.redd.it/abc/DASH_720.mp4?source=fallback')
        ).toBe('https://v.redd.it/abc/DASH_audio.mp4')
    })

    it('accepts Reddit video CDN subdomains', () => {
        expect(
            redditVideoAudioUrl('https://cf.v.redd.it/abc/CMAF_720.mp4')
        ).toBe('https://cf.v.redd.it/abc/CMAF_AUDIO_128.mp4')
    })

    it('rejects non-Reddit and non-video URLs', () => {
        expect(
            redditVideoAudioUrl('https://packaged-media.redd.it/abc/CMAF_720.mp4')
        ).toBeNull()
        expect(
            redditVideoAudioUrl('https://v.redd.it/abc/not-a-video.m3u8')
        ).toBeNull()
        expect(
            redditVideoAudioUrl('https://v.redd.it.evil.test/abc/CMAF_720.mp4')
        ).toBeNull()
        expect(redditVideoAudioUrl('not a url')).toBeNull()
    })
})
