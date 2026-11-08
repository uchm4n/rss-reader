// @vitest-environment jsdom
import {describe, expect, it} from 'vitest'
import type {SafeEmbed} from '../../src/popup/lib/embed'
import {createMediaCard} from '../../src/popup/lib/media-card'

const YOUTUBE: SafeEmbed = {
  provider: 'YouTube',
  url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  mode: 'link',
  pageUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  aspectRatio: 16 / 9
}

describe('createMediaCard', () => {
  it('builds a safe YouTube preview card', () => {
    const card = createMediaCard(YOUTUBE)

    expect(card.tagName).toBe('A')
    expect(card.className).toContain('media-card')
    expect(card.getAttribute('href')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    )
    expect(card.getAttribute('target')).toBe('_blank')
    expect(card.getAttribute('rel')).toBe('noreferrer noopener')
    expect(card.getAttribute('aria-label')).toBe('Watch on YouTube')
    expect(card.querySelector('img')?.getAttribute('src')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    )
    expect(card.querySelector('img')?.getAttribute('loading')).toBe('lazy')
    expect(card.querySelector('img')?.getAttribute('referrerpolicy')).toBe(
      'no-referrer'
    )
    expect(card.querySelector('iframe')).toBeNull()
    expect(card.textContent).toContain('YouTube')
  })

  it('renders a playable card without a thumbnail', () => {
    const card = createMediaCard({...YOUTUBE, thumbnailUrl: null})

    expect(card.querySelector('img')).toBeNull()
    expect(card.classList.contains('media-card-no-thumb')).toBe(true)
    expect(card.textContent).toContain('YouTube')
  })
})
