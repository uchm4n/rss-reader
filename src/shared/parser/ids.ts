function stableHash(value: string): string {
    let hash = 5381
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 33) ^ value.charCodeAt(index)
    }
    return (hash >>> 0).toString(36)
}

export function postKey(
    feedId: string,
    guid: string | null,
    link: string | null,
    title: string,
    publishedAt: number
): string {
    const identity =
        guid?.trim() ||
        link?.trim() ||
        stableHash(`${title.trim().toLowerCase()}:${publishedAt}`)

    return `${feedId}:${identity}`
}
