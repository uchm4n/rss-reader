import {marked} from 'marked'
import type {ContentFormat} from '@/shared/model/post'
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
        image.setAttribute('loading', 'lazy')
        image.setAttribute('decoding', 'async')
        image.setAttribute('referrerpolicy', 'no-referrer')
    }

    return template.innerHTML
}

export function renderPostContent(
    content: string,
    declared?: ContentFormat
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

    return {kind, html: enhancePostHtml(sanitizePostHtml(content))}
}
