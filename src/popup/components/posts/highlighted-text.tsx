import {Fragment, type ReactNode, useMemo} from 'react'
import {findMatchRanges} from '@/shared/model/match-words'

export function HighlightedText({
    text,
    words
}: {
    text: string
    words?: readonly string[]
}) {
    const ranges = useMemo(() => findMatchRanges(text, words), [text, words])

    if (!ranges.length) return <>{text}</>

    const parts: ReactNode[] = []
    let cursor = 0

    ranges.forEach((range, index) => {
        if (range.start > cursor) {
            parts.push(
                <Fragment key={`text-${index}`}>{text.slice(cursor, range.start)}</Fragment>
            )
        }
        parts.push(
            <mark key={`mark-${index}`} className="match-highlight">
                {text.slice(range.start, range.end)}
            </mark>
        )
        cursor = range.end
    })

    if (cursor < text.length) {
        parts.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>)
    }

    return <>{parts}</>
}
