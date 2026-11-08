import {marked} from 'marked'
import type {ContentFormat} from '@/shared/model/post'
import {normalizeEmbedUrl, type SafeEmbed} from './embed'
import {createMediaCard} from './media-card'
import {renderRedditContent} from './reddit-content'
import {sanitizePostHtml} from './sanitize'

export type ContentKind = ContentFormat | 'json'

export type RenderedPostContent =
    | { kind: 'html' | 'markdown' | 'json'; html: string }
    | { kind: 'text'; text: string }

const HTML_TAG = /<\/?[a-z][^>]*>/i
const MARKDOWN_BLOCK = /(^|\n)\s{0,3}(?:#{1,6}\s|```|~~~|>\s|[-*+]\s|\d+[.)]\s)/
const MARKDOWN_INLINE = /\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\[[^\]\n]+]\([^)\n]+\)/

function isJson(value: string): boolean {
    const trimmed = value.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false

    try {
        JSON.parse(trimmed)
        return true
    } catch {
        return false
    }
}

function looksLikeMarkdown(value: string): boolean {
    return MARKDOWN_BLOCK.test(value) || MARKDOWN_INLINE.test(value)
}

export function detectContentKind(
    content: string,
    declared?: ContentFormat
): ContentKind {
    const value = content.trim()
    if (!value) return 'text'
    if (isJson(value)) return 'json'

    const hasHtml = HTML_TAG.test(content)
    if (declared === 'html') return hasHtml ? 'html' : 'text'
    if (declared === 'markdown') return 'markdown'
    if (hasHtml && declared !== 'text') return 'html'
    if (looksLikeMarkdown(content)) return 'markdown'
    return 'text'
}

export function formatJson(value: string): string {
    return JSON.stringify(JSON.parse(value), null, 2)
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function decodeText(value: string): string {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = value
    return textarea.value
}

function directVideoUrl(raw: string): string | null {
    try {
        const url = new URL(raw)
        if (url.protocol !== 'https:') return null
        if (!/\.(mp4|webm|ogg)$/i.test(url.pathname)) return null
        return url.toString()
    } catch {
        return null
    }
}

function insertionPoint(anchor: Element): Element {
    const table = anchor.closest('table')
    if (table) {
        return table.parentElement?.classList.contains('table-scroll')
            ? table.parentElement
            : table
    }

    const textBlock = anchor.closest('p, figure, blockquote')
    if (textBlock) return textBlock

    const list = anchor.closest('li')?.parentElement
    if (list) return list

    return anchor.closest('div, section') ?? anchor.parentElement ?? anchor
}

function shouldReplaceBlock(block: Element, anchor: Element): boolean {
    const table = block.querySelector('table')
    if (block.classList.contains('table-scroll') && table) {
        return !table.querySelector('th') && table.rows.length <= 2
    }
    if (block.tagName === 'TABLE') {
        return !block.querySelector('th') && (block as HTMLTableElement).rows.length <= 2
    }
    if (block.tagName === 'LI') return false

    const blockText = (block.textContent ?? '').replace(/\s+/g, ' ').trim()
    const anchorText = (anchor.textContent ?? '').replace(/\s+/g, ' ').trim()
    return !blockText || blockText === anchorText
}

function createEmbedIframe(url: string): Element | null {
    const template = document.createElement('template')
    template.innerHTML = sanitizePostHtml(
        `<iframe src="${escapeHtml(url)}"></iframe>`
    )
    return template.content.firstElementChild
}

function createVideo(url: string): HTMLVideoElement {
    const video = document.createElement('video')
    video.setAttribute('src', url)
    video.setAttribute('controls', '')
    video.setAttribute('playsinline', '')
    video.setAttribute('preload', 'metadata')
    return video
}

function codeLanguage(pre: HTMLPreElement): string {
    const code = pre.querySelector('code')
    const match = /(?:^|\s)(?:language|lang)-([\w+#.-]+)/i.exec(
        `${pre.className} ${code?.className ?? ''}`
    )
    return match?.[1]?.toUpperCase() ?? ''
}

export function enhancePostHtml(html: string): string {
    const template = document.createElement('template')
    template.innerHTML = html
    const root = template.content

    for (const pre of root.querySelectorAll('pre')) {
        if (pre.parentElement?.classList.contains('code-block')) continue

        const wrapper = document.createElement('div')
        wrapper.className = 'code-block'

        const header = document.createElement('div')
        header.className = 'code-block-header'

        const language = document.createElement('span')
        language.className = 'code-block-language'
        language.textContent = codeLanguage(pre) || 'Code'

        const copy = document.createElement('button')
        copy.type = 'button'
        copy.className = 'code-block-copy'
        copy.dataset.copyCode = ''
        copy.textContent = 'Copy'

        header.append(language, copy)
        pre.replaceWith(wrapper)
        wrapper.append(header, pre)
    }

    for (const table of root.querySelectorAll('table')) {
        if (table.parentElement?.classList.contains('table-scroll')) continue

        const wrapper = document.createElement('div')
        wrapper.className = 'table-scroll'
        table.replaceWith(wrapper)
        wrapper.append(table)
    }

    for (const image of root.querySelectorAll('img')) {
        const width = Number(image.getAttribute('width'))
        const height = Number(image.getAttribute('height'))
        if (
            Number.isFinite(width) &&
            width > 0 &&
            Number.isFinite(height) &&
            height > 0
        ) {
            image.style.setProperty('aspect-ratio', `${width} / ${height}`)
        }

        image.removeAttribute('width')
        image.removeAttribute('height')
        image.setAttribute('loading', 'lazy')
        image.setAttribute('decoding', 'async')
        image.setAttribute('referrerpolicy', 'no-referrer')
    }

    for (const video of root.querySelectorAll('video')) {
        video.setAttribute('controls', '')
        video.setAttribute('playsinline', '')
        video.setAttribute('preload', 'metadata')
        video.removeAttribute('autoplay')
    }

    for (const audio of root.querySelectorAll('audio')) {
        audio.setAttribute('controls', '')
        audio.setAttribute('preload', 'metadata')
        audio.removeAttribute('autoplay')
    }

    const seenMedia = new Set<string>()
    for (const media of root.querySelectorAll('iframe, video')) {
        const src = media.getAttribute('src')
        if (src) seenMedia.add(src)
    }

    const seenCards = new Set<string>()
    for (const iframe of root.querySelectorAll('iframe')) {
        const embed = normalizeEmbedUrl(iframe.getAttribute('src'))
        if (!embed || embed.mode !== 'link') continue
        if (seenCards.has(embed.url)) {
            iframe.remove()
            continue
        }
        seenCards.add(embed.url)
        iframe.replaceWith(createMediaCard(embed))
    }

    type CandidateMedia =
        | { kind: 'card'; embed: SafeEmbed }
        | { kind: 'embed'; embed: SafeEmbed }

    const candidates = new Map<
        Element,
        { media?: CandidateMedia; video?: string; anchor?: Element }
    >()
    for (const anchor of root.querySelectorAll('a[href]')) {
        const href = anchor.getAttribute('href')
        if (!href) continue

        const inRedditCard = Boolean(anchor.closest('.reddit-card'))
        const inRedditSummary = Boolean(anchor.closest('.reddit-summary'))
        if (inRedditCard && !inRedditSummary) continue

        const embed = normalizeEmbedUrl(href)
        if (inRedditSummary && embed?.mode !== 'link') continue

        const block = insertionPoint(anchor)
        if (block.querySelector('iframe, video, .media-card')) continue

        const candidate = candidates.get(block) ?? {}
        const videoUrl = directVideoUrl(href)
        if (videoUrl) {
            candidate.video = videoUrl
            candidate.anchor = anchor
            candidates.set(block, candidate)
            continue
        }

        if (!embed || candidate.media) continue

        candidate.media = embed.mode === 'link'
            ? {kind: 'card', embed}
            : {kind: 'embed', embed}
        candidate.anchor = anchor
        candidates.set(block, candidate)
    }

    for (const [block, candidate] of candidates) {
        const replace = candidate.anchor
            ? shouldReplaceBlock(block, candidate.anchor)
            : false

        if (candidate.video) {
            if (seenMedia.has(candidate.video)) continue
            seenMedia.add(candidate.video)
            const video = createVideo(candidate.video)
            if (replace) block.replaceWith(video)
            else block.after(video)
            continue
        }

        if (!candidate.media) continue

        if (candidate.media.kind === 'card') {
            const embed = candidate.media.embed
            if (seenCards.has(embed.url)) continue
            seenCards.add(embed.url)
            const card = createMediaCard(embed)
            if (replace) block.replaceWith(card)
            else block.after(card)
            continue
        }

        const embed = candidate.media.embed
        if (seenMedia.has(embed.url)) continue
        seenMedia.add(embed.url)
        const iframe = createEmbedIframe(embed.url)
        if (!iframe) continue
        if (replace) block.replaceWith(iframe)
        else block.after(iframe)
    }

    return template.innerHTML
}

export function renderPostContent(
    content: string,
    declared?: ContentFormat,
    imageUrl?: string | null
): RenderedPostContent {
    const kind = detectContentKind(content, declared)
    if (kind === 'text') {
        return {kind, text: declared === 'text' ? content : decodeText(content)}
    }

    if (kind === 'json') {
        const html = `<pre><code class="language-json">${escapeHtml(formatJson(content))}</code></pre>`
        return {kind, html: enhancePostHtml(sanitizePostHtml(html))}
    }

    if (kind === 'markdown') {
        const html = marked.parse(content, {async: false, gfm: true})
        return {kind, html: enhancePostHtml(sanitizePostHtml(html))}
    }

    const reddit = renderRedditContent(content, imageUrl)
    return {
        kind,
        html: enhancePostHtml(sanitizePostHtml(reddit ?? content))
    }
}
