import {type MouseEvent, useEffect, useMemo, useRef} from 'react'
import type {ContentFormat} from '@/shared/model/post'
import {highlightPostHtml} from '../../lib/highlight'
import {renderPostContent} from '../../lib/post-content'
import {attachVideoAudio} from '../../lib/video-audio'
import {HighlightedText} from './highlighted-text'

interface PostBodyProps {
    content: string
    contentType?: ContentFormat
    imageUrl?: string | null
    matchWords?: readonly string[]
    autoplayVideo?: boolean
}

function copyCode(event: MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof Element)) return

    const button = target.closest<HTMLButtonElement>('[data-copy-code]')
    if (!button || !navigator.clipboard) return

    const code = button.closest('.code-block')?.querySelector('pre')?.textContent
    if (!code) return

    void navigator.clipboard
        .writeText(code)
        .then(() => {
            const label = button.textContent ?? 'Copy'
            button.textContent = 'Copied'
            window.setTimeout(() => {
                button.textContent = label
            }, 1200)
        })
        .catch(() => {})
}

export function PostBody({
                             content,
                             contentType,
                             imageUrl,
                             matchWords,
                             autoplayVideo = false
                         }: PostBodyProps) {
    const rendered = useMemo(
        () => renderPostContent(content, contentType, imageUrl, {autoplayVideo, muted: false}),
        [content, contentType, imageUrl, autoplayVideo]
    )
    const highlighted = useMemo(
        () => (rendered.kind === 'text' ? null : highlightPostHtml(rendered.html, matchWords)),
        [rendered, matchWords]
    )
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const root = rootRef.current
        if (!root) return
        return attachVideoAudio(root)
    }, [highlighted])

    if (rendered.kind === 'text') {
        return (
            <div className="post-content whitespace-pre-wrap">
                <HighlightedText text={rendered.text} words={matchWords}/>
            </div>
        )
    }

    return (
        <div
            ref={rootRef}
            className="post-content"
            onClick={copyCode}
            dangerouslySetInnerHTML={{__html: highlighted ?? ''}}
        />
    )
}
