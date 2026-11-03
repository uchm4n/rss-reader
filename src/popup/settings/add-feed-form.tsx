import {type FormEvent, useState} from 'react'
import {toast} from 'sonner'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import type {Folder} from '@/db/types'
import {sendCommand} from '../lib/commands'

export const INTERVAL_OPTIONS = [
    {value: 30, label: '30 seconds'},
    {value: 60, label: '1 minute'},
    {value: 300, label: '5 minutes'},
    {value: 900, label: '15 minutes (Default)'},
    {value: 1_800, label: '30 minutes'},
    {value: 3_600, label: '1 hour'}
]

const selectClass =
    'h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground'

export function AddFeedForm({
                                folders,
                                onAdded,
                                initialUrl = '',
                                sourceTabId,
                                onCancel
                            }: {
    folders: Folder[]
    onAdded: () => void
    initialUrl?: string
    sourceTabId?: number
    onCancel?: () => void
}) {
    const [url, setUrl] = useState(initialUrl)
    const [folderId, setFolderId] = useState('')
    const [refreshInterval, setRefreshInterval] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        if (!url.trim()) return

        setBusy(true)
        setError(null)
        try {
            await sendCommand({
                type: 'feed:add',
                url,
                folderId: folderId || null,
                refreshInterval: refreshInterval ? Number(refreshInterval) : null,
                sourceTabId
            })
            setUrl('')
            onAdded()
            toast.success('Feed added')
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Could not add feed'
            setError(message)
            toast.error(message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={(event) => void submit(event)} className="space-y-2">
            <div className="flex items-center gap-2">
                <Input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com/feed.xml"
                    aria-label="Feed URL"
                    className="h-8 min-w-0 flex-1 text-xs"
                />
                <Button type="submit" size="sm" disabled={busy || !url.trim()}>
                    {busy ? 'Adding…' : 'Add feed'}
                </Button>
                {onCancel ? (
                    <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                        Cancel
                    </Button>
                ) : null}
            </div>
            <div className="flex items-center gap-2">
                <select
                    aria-label="Feed folder"
                    className={selectClass}
                    value={folderId}
                    onChange={(event) => setFolderId(event.target.value)}
                >
                    <option value="">No folder</option>
                    {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                            {folder.name}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Feed refresh interval"
                    className={selectClass}
                    value={refreshInterval}
                    onChange={(event) => setRefreshInterval(event.target.value)}
                >
                    <option value="">Global interval</option>
                    {INTERVAL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
            {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
        </form>
    )
}
