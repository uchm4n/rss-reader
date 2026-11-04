import {type MouseEvent, useMemo} from 'react'
import type {ContentFormat} from '@/shared/model/post'
import {renderPostContent} from '../../lib/post-content'

interface PostBodyProps {
    content: string
    contentType?: ContentFormat
    imageUrl?: string | null
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

export function PostBody({content, contentType, imageUrl}: PostBodyProps) {
    const rendered = useMemo(
        () => renderPostContent(content, contentType, imageUrl),
        [content, contentType, imageUrl]
    )

    if (rendered.kind === 'text') {
        return <div className="post-content whitespace-pre-wrap">{rendered.text}</div>
    }

    return (
        <div
            className="post-content"
            onClick={copyCode}
            dangerouslySetInnerHTML={{__html: rendered.html}}
        />
    )
}
