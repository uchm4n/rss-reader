import {useState} from 'react'
import {toast} from 'sonner'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import type {Feed} from '@/db/types'
import {formatRelativeTime} from '@/shared/model/post'
import {useFeeds} from '../hooks/use-feeds'
import {useFolders} from '../hooks/use-folders'
import {sendCommand} from '../lib/commands'
import {AddFeedForm, INTERVAL_OPTIONS} from './add-feed-form'

const selectClass =
    'h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground'

interface FeedDraft {
    title: string
    folderId: string
    refreshInterval: string
}

function message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback
}

export function FeedsSettings() {
    const feeds = useFeeds()
    const folders = useFolders()
    const [editingId, setEditingId] = useState<string | null>(null)
    const [draft, setDraft] = useState<FeedDraft>({
        title: '',
        folderId: '',
        refreshInterval: ''
    })

    const beginEdit = (feed: Feed) => {
        setEditingId(feed.id)
        setDraft({
            title: feed.title,
            folderId: feed.folderId ?? '',
            refreshInterval: feed.refreshInterval ? String(feed.refreshInterval) : ''
        })
    }

    const save = async () => {
        if (!editingId) return

        try {
            await sendCommand({
                type: 'feed:update',
                id: editingId,
                patch: {
                    title: draft.title,
                    folderId: draft.folderId || null,
                    refreshInterval: draft.refreshInterval ? Number(draft.refreshInterval) : null
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
            <AddFeedForm folders={folders ?? []} onAdded={() => {
            }}/>

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
                                <div className="flex items-center gap-2">
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
                                </div>
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
