import {describe, expect, it} from 'vitest'
import {normalizeEmbedUrl} from '../../src/popup/lib/embed'

describe('normalizeEmbedUrl', () => {
  it('normalizes YouTube watch, short, shorts and embed URLs', () => {
    const expected = {
      provider: 'YouTube',
      url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      aspectRatio: 16 / 9
    }

    expect(
      normalizeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    ).toMatchObject(expected)
    expect(normalizeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toMatchObject(expected)
    expect(
      normalizeEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')
    ).toMatchObject(expected)
    expect(
      normalizeEmbedUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    ).toMatchObject(expected)
  })

  it('normalizes Vimeo URLs and preserves the private hash', () => {
    expect(normalizeEmbedUrl('https://vimeo.com/123456789')).toMatchObject({
      provider: 'Vimeo',
      url: 'https://player.vimeo.com/video/123456789',
      aspectRatio: 16 / 9
    })
    expect(normalizeEmbedUrl('https://player.vimeo.com/video/123456789')).toMatchObject({
      provider: 'Vimeo',
      url: 'https://player.vimeo.com/video/123456789'
    })
    expect(
      normalizeEmbedUrl('https://vimeo.com/123456789?h=abc123def')
    ).toMatchObject({
      provider: 'Vimeo',
      url: 'https://player.vimeo.com/video/123456789?h=abc123def'
    })
  })

  it('normalizes Dailymotion URLs', () => {
    expect(
      normalizeEmbedUrl('https://www.dailymotion.com/video/x8abcde')
    ).toMatchObject({
      provider: 'Dailymotion',
      url: 'https://www.dailymotion.com/embed/video/x8abcde',
      aspectRatio: 16 / 9
    })
    expect(normalizeEmbedUrl('https://dai.ly/x8abcde')).toMatchObject({
      provider: 'Dailymotion',
      url: 'https://www.dailymotion.com/embed/video/x8abcde'
    })
  })

  it('normalizes Reddit posts and comments to redditmedia embeds', () => {
    const expected = {
      provider: 'Reddit',
      url: 'https://www.redditmedia.com/r/aww/comments/abc123/cute_dog/?ref_source=embed&ref=share&embed=true',
      aspectRatio: 4 / 3,
      forceAspectRatio: true
    }

    expect(
      normalizeEmbedUrl('https://www.reddit.com/r/aww/comments/abc123/cute_dog/')
    ).toMatchObject(expected)
    expect(
      normalizeEmbedUrl(
        'https://www.redditmedia.com/r/aww/comments/abc123/cute_dog/?ref_source=embed'
      )
    ).toMatchObject(expected)
  })

  it('normalizes Reddit media-only player URLs', () => {
    expect(
      normalizeEmbedUrl('https://www.reddit.com/mediaembed/1wen3tq')
    ).toMatchObject({
      provider: 'Reddit',
      url: 'https://www.reddit.com/mediaembed/1wen3tq',
      aspectRatio: 4 / 3,
      forceAspectRatio: true
    })
    expect(
      normalizeEmbedUrl('https://www.redditmedia.com/mediaembed/1wen3tq')
    ).toMatchObject({
      url: 'https://www.reddit.com/mediaembed/1wen3tq'
    })
  })

  it('normalizes TikTok posts and embed URLs to the player', () => {
    const expected = {
      provider: 'TikTok',
      url: 'https://www.tiktok.com/player/v1/6718335390845095173',
      aspectRatio: 9 / 16,
      forceAspectRatio: true
    }

    expect(
      normalizeEmbedUrl(
        'https://www.tiktok.com/@scout2015/video/6718335390845095173'
      )
    ).toMatchObject(expected)
    expect(
      normalizeEmbedUrl('https://www.tiktok.com/embed/v2/6718335390845095173')
    ).toMatchObject(expected)
  })

  it('normalizes Instagram posts, reels and TV embeds', () => {
    expect(normalizeEmbedUrl('https://www.instagram.com/p/fA9uwTtkSN/')).toMatchObject({
      provider: 'Instagram',
      url: 'https://www.instagram.com/p/fA9uwTtkSN/embed/',
      aspectRatio: 4 / 5,
      forceAspectRatio: true
    })
    expect(
      normalizeEmbedUrl('https://www.instagram.com/reel/fA9uwTtkSN/')
    ).toMatchObject({
      provider: 'Instagram',
      url: 'https://www.instagram.com/reel/fA9uwTtkSN/embed/'
    })
    expect(
      normalizeEmbedUrl('https://www.instagram.com/tv/fA9uwTtkSN/')
    ).toMatchObject({
      provider: 'Instagram',
      url: 'https://www.instagram.com/tv/fA9uwTtkSN/embed/'
    })
  })

  it('normalizes Facebook videos and posts to plugin iframes', () => {
    const video = normalizeEmbedUrl(
      'https://www.facebook.com/somepage/videos/1234567890/'
    )
    expect(video).toMatchObject({
      provider: 'Facebook',
      url: 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fsomepage%2Fvideos%2F1234567890%2F&show_text=false',
      aspectRatio: 16 / 9,
      forceAspectRatio: true
    })

    const post = normalizeEmbedUrl(
      'https://www.facebook.com/somepage/posts/1234567890'
    )
    expect(post).toMatchObject({
      provider: 'Facebook',
      url: 'https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fsomepage%2Fposts%2F1234567890',
      aspectRatio: 4 / 5
    })
  })

  it('rejects unknown hosts, non-https and relative URLs', () => {
    expect(normalizeEmbedUrl('https://example.com/embed/x')).toBeNull()
    expect(normalizeEmbedUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(normalizeEmbedUrl('/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(normalizeEmbedUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeEmbedUrl(null)).toBeNull()
  })
})
