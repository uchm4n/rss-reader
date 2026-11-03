const ENTITIES: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
}

const EXCERPT_LENGTH = 240

function decodeEntity(entity: string, code: string): string {
    if (code.startsWith('#')) {
        const hex = code[1]?.toLowerCase() === 'x'
        const value = Number.parseInt(hex ? code.slice(2) : code.slice(1), hex ? 16 : 10)
        return Number.isFinite(value) && value >= 0 && value <= 0x10ffff
            ? String.fromCodePoint(value)
            : entity
    }

    return ENTITIES[code.toLowerCase()] ?? entity
}

export function plainText(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, decodeEntity)
        .replace(/\s+/g, ' ')
        .trim()
}

export function excerptText(html: string): string {
    const text = plainText(html)
    return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH).trimEnd()}…` : text
}
