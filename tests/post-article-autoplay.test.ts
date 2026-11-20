// @vitest-environment jsdom
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, it} from 'vitest'
import {PostArticle} from '../src/popup/components/posts/post-reader'
import {feedFixture, postFixture} from './helpers/db'

const videoContent =
    '<p><a href="https://v.redd.it/abc/CMAF_1080.mp4?source=fallback">video</a></p>'

function render(feedUrl: string): string {
    return renderToStaticMarkup(
        React.createElement(PostArticle, {
            post: postFixture({
                contentHtml: videoContent,
                contentType: 'html',
                excerpt: ''
            }),
            feed: feedFixture({url: feedUrl}),
            onOpenOriginal: () => {}
        })
    )
}

describe('PostArticle Reddit video autoplay', () => {
    it('autoplays videos in Reddit feed articles', () => {
        const container = document.createElement('div')
        container.innerHTML = render('https://www.reddit.com/r/aww/.json')
        const video = container.querySelector('video')

        expect(video).not.toBeNull()
        expect(video?.hasAttribute('autoplay')).toBe(true)
        expect(video?.hasAttribute('muted')).toBe(false)
        expect(video?.muted).toBe(false)
    })

    it('does not autoplay videos in other feeds', () => {
        const html = render('https://example.com/feed.xml')

        expect(html).toContain('<video')
        expect(html).not.toContain('autoplay')
    })
})
