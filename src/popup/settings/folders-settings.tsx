import {type FormEvent, useState} from 'react'
import {ArrowDown, ArrowUp} from 'lucide-react'
import {toast} from 'sonner'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {useFeeds} from '../hooks/use-feeds'
import {useFolders} from '../hooks/use-folders'
import {sendCommand} from '../lib/commands'

function message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback
}

export function FoldersSettings() {
    const folders = useFolders()
    const feeds = useFeeds()
    const [name, setName] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [draftName, setDraftName] = useState('')

    const add = async (event: FormEvent) => {
        event.preventDefault()
        if (!name.trim()) return

        try {
            await sendCommand({type: 'folder:add', name})
            setName('')
            toast.success('Folder added')
        } catch (error) {
            toast.error(message(error, 'Could not add folder'))
        }
    }

    const rename = async (id: string) => {
        try {
            await sendCommand({type: 'folder:update', id, patch: {name: draftName}})
            setEditingId(null)
            toast.success('Folder renamed')
        } catch (error) {
            toast.error(message(error, 'Could not rename folder'))
        }
    }

    const move = async (
        folder: { id: string; sortOrder: number },
        direction: -1 | 1
    ) => {
        const ordered = [...(folders ?? [])].sort(
            (left, right) => left.sortOrder - right.sortOrder
        )
        const index = ordered.findIndex((candidate) => candidate.id === folder.id)
        const target = ordered[index + direction]
        if (!target) return

        try {
            await sendCommand({
                type: 'folder:update',
                id: folder.id,
                patch: {sortOrder: target.sortOrder}
            })
            await sendCommand({
                type: 'folder:update',
                id: target.id,
                patch: {sortOrder: folder.sortOrder}
            })
        } catch (error) {
            toast.error(message(error, 'Could not reorder folders'))
        }
    }

    const remove = async (id: string, folderName: string) => {
        if (!window.confirm(`Delete "${folderName}"? Its feeds move to the root.`)) return

        try {
            await sendCommand({type: 'folder:delete', id})
            toast.success('Folder deleted')
        } catch (error) {
            toast.error(message(error, 'Could not delete folder'))
        }
    }

    return (
        <div className="space-y-4">
            <form onSubmit={(event) => void add(event)} className="flex items-center gap-2">
                <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="New folder"
                    aria-label="Folder name"
                    className="h-8 min-w-0 flex-1 text-xs"
                />
                <Button type="submit" size="sm" disabled={!name.trim()}>
                    Add folder
                </Button>
            </form>

            {folders === undefined ? null : folders.length === 0 ? (
                <p className="text-xs text-muted-foreground">No folders yet.</p>
            ) : (
                <div className="divide-y rounded-md border">
                    {folders.map((folder, index) => {
                        const feedCount =
                            feeds?.filter((feed) => feed.folderId === folder.id).length ?? 0

                        return (
                            <div key={folder.id} className="flex items-center gap-2 p-3">
                                {editingId === folder.id ? (
                                    <>
                                        <Input
                                            value={draftName}
                                            onChange={(event) => setDraftName(event.target.value)}
                                            aria-label="Folder name"
                                            className="h-8 min-w-0 flex-1 text-xs"
                                        />
                                        <Button size="sm" onClick={() => void rename(folder.id)}>
                                            Save
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setEditingId(null)}
                                        >
                                            Cancel
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-medium">{folder.name}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {feedCount} {feedCount === 1 ? 'feed' : 'feeds'}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={`Move ${folder.name} up`}
                                            disabled={index === 0}
                                            onClick={() => void move(folder, -1)}
                                        >
                                            <ArrowUp className="size-4"/>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={`Move ${folder.name} down`}
                                            disabled={index === folders.length - 1}
                                            onClick={() => void move(folder, 1)}
                                        >
                                            <ArrowDown className="size-4"/>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditingId(folder.id)
                                                setDraftName(folder.name)
                                            }}
                                        >
                                            Rename
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => void remove(folder.id, folder.name)}
                                        >
                                            Delete
                                        </Button>
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
