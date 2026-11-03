import {useRef, useState} from 'react'
import {toast} from 'sonner'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {sendCommand} from '../lib/commands'

function message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback
}

export function OpmlSettings() {
    const fileInput = useRef<HTMLInputElement>(null)
    const [busy, setBusy] = useState(false)

    const importFile = async (file: File | undefined) => {
        if (!file) return

        setBusy(true)
        try {
            const xml = await file.text()
            const counts = await sendCommand<{ folders: number; feeds: number }>({
                type: 'opml:import',
                xml
            })
            toast.success(
                `Imported ${counts.feeds} ${counts.feeds === 1 ? 'feed' : 'feeds'} and ${counts.folders} ${counts.folders === 1 ? 'folder' : 'folders'}`
            )
        } catch (error) {
            toast.error(message(error, 'Could not import OPML'))
        } finally {
            setBusy(false)
            if (fileInput.current) fileInput.current.value = ''
        }
    }

    const exportFile = async () => {
        setBusy(true)
        try {
            const xml = await sendCommand<string>({type: 'opml:export'})
            const url = URL.createObjectURL(new Blob([xml], {type: 'application/xml'}))
            const link = document.createElement('a')
            link.href = url
            link.download = 'rss-reader-subscriptions.opml'
            link.click()
            URL.revokeObjectURL(url)
            toast.success('OPML exported')
        } catch (error) {
            toast.error(message(error, 'Could not export OPML'))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-4">
            <section className="space-y-2">
                <h2 className="text-sm font-semibold">Import</h2>
                <p className="text-xs text-muted-foreground">
                    Add feeds and folders from an OPML file. Imported feeds are fetched in
                    staggered batches.
                </p>
                <Input
                    ref={fileInput}
                    type="file"
                    accept=".opml,.xml,text/xml,application/xml"
                    aria-label="OPML file"
                    disabled={busy}
                    className="h-8 text-xs"
                    onChange={(event) => void importFile(event.target.files?.[0])}
                />
            </section>

            <section className="space-y-2">
                <h2 className="text-sm font-semibold">Export</h2>
                <p className="text-xs text-muted-foreground">
                    Download every feed and folder as an OPML file.
                </p>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void exportFile()}>
                    Export OPML
                </Button>
            </section>
        </div>
    )
}
