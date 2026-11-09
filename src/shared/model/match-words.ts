import type {Post} from '../../db/types'
import {plainText} from '../parser/html'

export const MAX_MATCH_WORDS = 20
export const MAX_MATCH_WORD_LENGTH = 40

export interface MatchRange {
    start: number
    end: number
}

interface Token {
    value: string
    stem: string
    start: number
    end: number
}

interface WordToken {
    value: string
    stem: string
}

interface CompiledWord {
    display: string
    tokens: WordToken[]
}

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu

function normalizeToken(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/\p{M}+/gu, '')
        .toLowerCase()
}

function trimDoubleConsonant(value: string): string {
    const last = value.at(-1)
    if (last && last === value.at(-2) && !'lszf'.includes(last)) {
        return value.slice(0, -1)
    }
    return value
}

function stem(value: string): string {
    if (value.length > 4 && value.endsWith('ies')) return `${value.slice(0, -3)}y`
    if (value.length > 4 && value.endsWith('ing')) {
        return trimDoubleConsonant(value.slice(0, -3))
    }
    if (value.length > 4 && value.endsWith('ed')) {
        return trimDoubleConsonant(value.slice(0, -2))
    }
    if (value.length > 3 && value.endsWith('es')) return value.slice(0, -2)
    if (value.length > 3 && value.endsWith('s') && !value.endsWith('ss')) {
        return value.slice(0, -1)
    }
    return value
}

function tokensFor(value: string): WordToken[] {
    return [...value.matchAll(TOKEN_PATTERN)].map((match) => {
        const normalized = normalizeToken(match[0])
        return {value: normalized, stem: stem(normalized)}
    })
}

function tokensWithOffsets(value: string): Token[] {
    const tokens: Token[] = []

    for (const match of value.matchAll(TOKEN_PATTERN)) {
        const normalized = normalizeToken(match[0])
        if (!normalized) continue
        const start = match.index ?? 0
        tokens.push({
            value: normalized,
            stem: stem(normalized),
            start,
            end: start + match[0].length
        })
    }

    return tokens
}

function wordKey(value: string): string {
    return tokensFor(value)
        .map((token) => token.stem)
        .join(' ')
}

export function sanitizeMatchWords(words: readonly string[] | undefined): string[] {
    if (!words?.length) return []

    const result: string[] = []
    const seen = new Set<string>()

    for (const raw of words) {
        const value = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_MATCH_WORD_LENGTH).trim()
        if (!value) continue

        const key = wordKey(value)
        if (!key || seen.has(key)) continue

        seen.add(key)
        result.push(value)
        if (result.length >= MAX_MATCH_WORDS) break
    }

    return result
}

function editDistance(left: string, right: string): number {
    const rows = left.length + 1
    const columns = right.length + 1
    const matrix = Array.from({length: rows}, () =>
        new Array<number>(columns).fill(0)
    )

    for (let row = 0; row < rows; row += 1) matrix[row][0] = row
    for (let column = 0; column < columns; column += 1) matrix[0][column] = column

    for (let row = 1; row < rows; row += 1) {
        for (let column = 1; column < columns; column += 1) {
            const cost = left[row - 1] === right[column - 1] ? 0 : 1
            matrix[row][column] = Math.min(
                matrix[row - 1][column] + 1,
                matrix[row][column - 1] + 1,
                matrix[row - 1][column - 1] + cost
            )

            if (
                row > 1 &&
                column > 1 &&
                left[row - 1] === right[column - 2] &&
                left[row - 2] === right[column - 1]
            ) {
                matrix[row][column] = Math.min(
                    matrix[row][column],
                    matrix[row - 2][column - 2] + 1
                )
            }
        }
    }

    return matrix[left.length][right.length]
}

function tokenMatches(needle: WordToken, haystack: Token): boolean {
    if (needle.value === haystack.value) return true
    if (needle.stem === haystack.stem) return true

    const short = needle.stem.length <= haystack.stem.length ? needle.stem : haystack.stem
    const long = short === needle.stem ? haystack.stem : needle.stem
    if (short.length >= 4 && long.startsWith(short) && long.length - short.length <= 3) {
        return true
    }

    const shortest = Math.min(needle.stem.length, haystack.stem.length)
    const longest = Math.max(needle.stem.length, haystack.stem.length)
    if (shortest < 4) return false

    const threshold = longest < 10 ? 1 : 2
    if (longest - shortest > threshold) return false
    return editDistance(needle.stem, haystack.stem) <= threshold
}

function phraseMatches(word: CompiledWord, tokens: Token[]): boolean {
    const length = word.tokens.length
    if (!length || tokens.length < length) return false

    for (let index = 0; index <= tokens.length - length; index += 1) {
        let matched = true
        for (let offset = 0; offset < length; offset += 1) {
            if (!tokenMatches(word.tokens[offset], tokens[index + offset])) {
                matched = false
                break
            }
        }
        if (matched) return true
    }

    return false
}

function compileWords(words: readonly string[] | undefined): CompiledWord[] {
    return sanitizeMatchWords(words)
        .map((display) => ({display, tokens: tokensFor(display)}))
        .filter((word) => word.tokens.length > 0)
}

function postText(
    post: Pick<Post, 'title' | 'excerpt' | 'contentHtml' | 'contentType'>
): string {
    const content = post.contentHtml ?? ''
    const body =
        content && (post.contentType === 'html' || post.contentType === undefined)
            ? plainText(content)
            : content
    return `${post.title} ${post.excerpt} ${body}`
}

export function findMatchedWords(
    words: readonly string[] | undefined,
    posts: readonly Pick<Post, 'title' | 'excerpt' | 'contentHtml' | 'contentType'>[]
): string[] {
    const compiled = compileWords(words)
    if (!compiled.length || !posts.length) return []

    const matched = new Set<string>()

    for (const post of posts) {
        const tokens = tokensWithOffsets(postText(post))
        for (const word of compiled) {
            if (!matched.has(word.display) && phraseMatches(word, tokens)) {
                matched.add(word.display)
            }
        }
        if (matched.size === compiled.length) break
    }

    return compiled
        .filter((word) => matched.has(word.display))
        .map((word) => word.display)
}

function mergeRanges(ranges: MatchRange[]): MatchRange[] {
    ranges.sort((left, right) => left.start - right.start || right.end - left.end)

    const merged: MatchRange[] = []
    for (const range of ranges) {
        const last = merged.at(-1)
        if (last && range.start < last.end) {
            last.end = Math.max(last.end, range.end)
        } else {
            merged.push({...range})
        }
    }

    return merged
}

export function createMatchRanges(
    words: readonly string[] | undefined
): (text: string) => MatchRange[] {
    const compiled = compileWords(words)

    return (text: string): MatchRange[] => {
        if (!compiled.length || !text) return []

        const tokens = tokensWithOffsets(text)
        if (!tokens.length) return []

        const ranges: MatchRange[] = []

        for (const word of compiled) {
            const length = word.tokens.length
            for (let index = 0; index <= tokens.length - length; index += 1) {
                let matched = true
                for (let offset = 0; offset < length; offset += 1) {
                    if (!tokenMatches(word.tokens[offset], tokens[index + offset])) {
                        matched = false
                        break
                    }
                }
                if (matched) {
                    ranges.push({
                        start: tokens[index].start,
                        end: tokens[index + length - 1].end
                    })
                }
            }
        }

        return mergeRanges(ranges)
    }
}

export function findMatchRanges(
    text: string,
    words: readonly string[] | undefined
): MatchRange[] {
    return createMatchRanges(words)(text)
}
