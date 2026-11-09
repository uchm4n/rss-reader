import {createMatchRanges} from '@/shared/model/match-words'

const SKIP_SELECTOR =
    'pre, code, button, svg, script, style, textarea, .code-block, .media-card, .match-highlight'

export function highlightPostHtml(
    html: string,
    words: readonly string[] | undefined
): string {
    if (!html || !words?.length) return html

    const rangesFor = createMatchRanges(words)
    const template = document.createElement('template')
    template.innerHTML = html

    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentElement
            if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT
            if (parent?.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT
            return NodeFilter.FILTER_ACCEPT
        }
    })

    const textNodes: Text[] = []
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

    for (const node of textNodes) {
        const text = node.nodeValue ?? ''
        const ranges = rangesFor(text)
        if (!ranges.length) continue

        const fragment = document.createDocumentFragment()
        let cursor = 0

        for (const range of ranges) {
            if (range.start > cursor) fragment.append(text.slice(cursor, range.start))
            const mark = document.createElement('mark')
            mark.className = 'match-highlight'
            mark.textContent = text.slice(range.start, range.end)
            fragment.append(mark)
            cursor = range.end
        }

        if (cursor < text.length) fragment.append(text.slice(cursor))
        node.replaceWith(fragment)
    }

    return template.innerHTML
}
