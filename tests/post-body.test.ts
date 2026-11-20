// @vitest-environment jsdom
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {PostBody} from '@/popup/components/posts/post-body.tsx'
import {attachVideoAudio} from '@/popup/lib/video-audio.ts'

describe('PostBody', () => {
  it('renders plain text with preserved line breaks', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostBody, {content: 'First line.\nSecond line.'})
    )

    expect(html).toContain('whitespace-pre-wrap')
    expect(html).toContain('First line.\nSecond line.')
  })

  it('renders JSON through the code block enhancer', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostBody, {content: '{"a":1}'})
    )

    expect(html).toContain('language-json')
    expect(html).toContain('data-copy-code')
  })

  it('highlights matching plain text', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostBody, {
        content: 'Hello WordPress',
        matchWords: ['WordPress']
      })
    )

    expect(html).toContain('<mark class="match-highlight">WordPress</mark>')
  })

  it('highlights matching prose but not code', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostBody, {
        content: '<p>WordPress</p><pre><code>WordPress</code></pre>',
        contentType: 'html',
        matchWords: ['WordPress']
      })
    )
    const document = new DOMParser().parseFromString(html, 'text/html')

    expect(document.querySelectorAll('mark.match-highlight')).toHaveLength(1)
    expect(document.querySelector('pre mark')).toBeNull()
  })
})

describe('attachVideoAudio', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('attaches a hidden audio track and mirrors play and pause', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<video data-audio-src="https://v.redd.it/abc/CMAF_AUDIO_128.mp4"></video>'
    const video = root.querySelector('video')
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined)
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {})

    const stop = attachVideoAudio(root)
    const audio = root.querySelector('audio')

    expect(video).not.toBeNull()
    expect(audio).not.toBeNull()
    expect(audio?.hidden).toBe(true)
    expect(audio?.style.display).toBe('none')
    expect(audio?.getAttribute('src')).toBe(
      'https://v.redd.it/abc/CMAF_AUDIO_128.mp4'
    )

    video?.dispatchEvent(new Event('play'))
    expect(play).toHaveBeenCalled()
    expect(audio?.muted).toBe(false)

    video?.dispatchEvent(new Event('pause'))
    expect(pause).toHaveBeenCalled()

    stop()
    expect(root.querySelector('audio')).toBeNull()
  })
})
