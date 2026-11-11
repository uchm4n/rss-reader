import {useRef, useState} from 'react'
import {toast} from 'sonner'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import type {Feed} from '@/db/types'
import {formatRelativeTime} from '@/shared/model/post'
import {useFeeds} from '../hooks/use-feeds'
import {useFolders} from '../hooks/use-folders'
import {useSettings} from '../hooks/use-settings'
import {sendCommand} from '../lib/commands'
import {AddFeedForm, INTERVAL_OPTIONS, parseFeedLimit} from './add-feed-form'
import {MatchWordsInput, type MatchWordsInputHandle} from './match-words-input'

const selectClass =
    'h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground'

interface FeedDraft {
    title: string
    folderId: string
    refreshInterval: string
    retentionPerFeed: string
    matchWords: string[]
}

function message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback
}

export function FeedsSettings({
    initialUrl = '',
    onFeedAdded
}: {
    initialUrl?: string
    onFeedAdded?: () => void
} = {}) {
    const feeds = useFeeds()
    const folders = useFolders()
    const settings = useSettings()
    const [editingId, setEditingId] = useState<string | null>(null)
    const matchWordsRef = useRef<MatchWordsInputHandle>(null)
    const [draft, setDraft] = useState<FeedDraft>({
        title: '',
        folderId: '',
        refreshInterval: '',
        retentionPerFeed: '',
        matchWords: []
    })

    const beginEdit = (feed: Feed) => {
        setEditingId(feed.id)
        setDraft({
            title: feed.title,
            folderId: feed.folderId ?? '',
            refreshInterval: feed.refreshInterval ? String(feed.refreshInterval) : '',
            retentionPerFeed: feed.retentionPerFeed ? String(feed.retentionPerFeed) : '',
            matchWords: feed.matchWords ?? []
        })
    }

    const save = async () => {
        if (!editingId) return

        try {
            const matchWords = matchWordsRef.current?.commit() ?? draft.matchWords
            await sendCommand({
                type: 'feed:update',
                id: editingId,
                patch: {
                    title: draft.title,
                    folderId: draft.folderId || null,
                    refreshInterval: draft.refreshInterval ? Number(draft.refreshInterval) : null,
                    retentionPerFeed: parseFeedLimit(draft.retentionPerFeed),
                    matchWords
                }
            })
            setEditingId(null)
            toast.success('Feed updated')
        } catch (error) {
            toast.error(message(error, 'Could not update feed'))
        }
    }

    const remove = async (feed: Feed) => {
        if (!window.confirm(`Delete "${feed.title}" and its posts?`)) return

        try {
            await sendCommand({type: 'feed:delete', id: feed.id})
            toast.success('Feed deleted')
        } catch (error) {
            toast.error(message(error, 'Could not delete feed'))
        }
    }

    const folderName = (folderId: string | null) =>
        folders?.find((folder) => folder.id === folderId)?.name ?? 'No folder'

    return (
        <div className="space-y-4">
            <AddFeedForm
                folders={folders ?? []}
                initialUrl={initialUrl}
                globalRetention={settings?.retentionPerFeed}
                onAdded={() => onFeedAdded?.()}
            />

            {feeds === undefined ? null : feeds.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    No feeds yet. Add one above or import an OPML file.
                </p>
            ) : (
                <div className="divide-y rounded-md border">
                    {feeds.map((feed) =>
                        editingId === feed.id ? (
                            <div key={feed.id} className="space-y-2 p-3">
                                <Input
                                    value={draft.title}
                                    onChange={(event) =>
                                        setDraft((previous) => ({...previous, title: event.target.value}))
                                    }
                                    aria-label="Feed title"
                                    className="h-8 text-xs"
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        aria-label="Feed folder"
                                        className={selectClass}
                                        value={draft.folderId}
                                        onChange={(event) =>
                                            setDraft((previous) => ({
                                                ...previous,
                                                folderId: event.target.value
                                            }))
                                        }
                                    >
                                        <option value="">No folder</option>
                                        {(folders ?? []).map((folder) => (
                                            <option key={folder.id} value={folder.id}>
                                                {folder.name}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        aria-label="Feed refresh interval"
                                        className={selectClass}
                                        value={draft.refreshInterval}
                                        onChange={(event) =>
                                            setDraft((previous) => ({
                                                ...previous,
                                                refreshInterval: event.target.value
                                            }))
                                        }
                                    >
                                        <option value="">Global interval</option>
                                        {INTERVAL_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <Input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={draft.retentionPerFeed}
                                        onChange={(event) =>
                                            setDraft((previous) => ({
                                                ...previous,
                                                retentionPerFeed: event.target.value
                                            }))
                                        }
                                        placeholder={ settings ? `Limit: ${settings.retentionPerFeed}` : 'Global' }
                                        title="Posts to keep. Leave empty to use the global limit."
                                        aria-label="Feed post limit"
                                        className="h-8 w-24 text-xs"
                                    />
                                </div>
                                <MatchWordsInput
                                    ref={matchWordsRef}
                                    value={draft.matchWords}
                                    onChange={(matchWords) =>
                                        setDraft((previous) => ({...previous, matchWords}))
                                    }
                                />
                                <div className="flex items-center gap-2">
                                    <Button size="sm" onClick={() => void save()}>
                                        Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div key={feed.id} className="flex items-start gap-3 p-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium">{feed.title}</p>
                                    <p className="truncate text-[11px] text-muted-foreground">{feed.url}</p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                        {folderName(feed.folderId)} ·{' '}
                                        {feed.lastFetchedAt
                                            ? `Fetched ${formatRelativeTime(new Date(feed.lastFetchedAt))}`
                                            : 'Never fetched'}
                                        {feed.retentionPerFeed ? ` · ${feed.retentionPerFeed} posts` : ''}
                                    </p>
                                    {feed.lastError ? (
                                        <p className="mt-1 truncate text-[11px] text-destructive">
                                            {feed.lastError}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => beginEdit(feed)}
                                        aria-label={`Edit ${feed.title}`}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void remove(feed)}
                                        aria-label={`Delete ${feed.title}`}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    )
}
