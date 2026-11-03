import {generateOpml as generate, type Opml, parseOpml} from 'feedsmith'
import type {Feed, Folder} from '../../db/types'

export interface OpmlFeed {
    url: string
    title: string
    folderPath: string[]
}

function outlineTitle(outline: Opml.Outline<string>): string {
    return outline.title?.trim() || outline.text?.trim() || 'Untitled'
}

function walk(
    outlines: Array<Opml.Outline<string>> | undefined,
    folderPath: string[],
    result: OpmlFeed[]
): void {
    for (const outline of outlines ?? []) {
        const url = outline.xmlUrl?.trim()

        if (url) {
            result.push({url, title: outlineTitle(outline), folderPath})
            continue
        }

        if (outline.outlines?.length) {
            walk(outline.outlines, [...folderPath, outlineTitle(outline)], result)
        }
    }
}

export function parseOpmlFeeds(xml: string): OpmlFeed[] {
    let document: Opml.Document<string>

    try {
        document = parseOpml(xml)
    } catch {
        throw new Error('Unrecognized OPML format')
    }

    const feeds: OpmlFeed[] = []
    walk(document.body?.outlines, [], feeds)
    return feeds
}

function feedOutline(feed: Feed): Opml.Outline<string> {
    return {
        text: feed.title || feed.url,
        title: feed.title || feed.url,
        type: 'rss',
        xmlUrl: feed.url,
        ...(feed.siteUrl ? {htmlUrl: feed.siteUrl} : {})
    }
}

export function generateOpml(folders: Folder[], feeds: Feed[]): string {
    const folderOutlines: Array<Opml.Outline<string>> = folders.map((folder) => ({
        text: folder.name,
        title: folder.name,
        outlines: feeds
            .filter((feed) => feed.folderId === folder.id)
            .map(feedOutline)
    }))
    const rootFeeds = feeds
        .filter((feed) => !feed.folderId)
        .map(feedOutline)

    return generate({
        head: {title: 'RSS Reader subscriptions'},
        body: {outlines: [...folderOutlines, ...rootFeeds]}
    })
}
