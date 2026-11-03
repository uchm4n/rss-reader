import {useEffect, useState} from 'react'
import {toast} from 'sonner'
import {Button} from '@/components/ui/button'
import {sendCommand} from '../lib/commands'

interface StorageEstimate {
    usage: number
    quota: number
}

function formatBytes(bytes: number): string {
    if (!bytes) return '0 B'

    const units = ['B', 'KB', 'MB', 'GB']
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
    )
    const value = bytes / 1024 ** index
    return `${index === 0 ? value : value.toFixed(1)} ${units[index]}`
}

export function StorageSettings() {
    const [estimate, setEstimate] = useState<StorageEstimate | null>(null)
    const [busy, setBusy] = useState(false)

    const loadEstimate = async () => {
        try {
            const result = await navigator.storage.estimate()
            setEstimate({usage: result.usage ?? 0, quota: result.quota ?? 0})
        } catch {
            setEstimate(null)
        }
    }

    useEffect(() => {
        void loadEstimate()
    }, [])

    const clearAll = async () => {
        if (
            !window.confirm(
                'Delete every feed, folder, post and setting from this browser?'
            )
        ) {
            return
        }

        setBusy(true)
        try {
            await sendCommand({type: 'data:clear'})
            await loadEstimate()
            toast.success('Local data cleared')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not clear data')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-4">
            <section className="space-y-2">
                <h2 className="text-sm font-semibold">Storage</h2>
                <p className="text-xs text-muted-foreground">
                    {estimate
                        ? `${formatBytes(estimate.usage)} used of ${formatBytes(estimate.quota)} available.`
                        : 'Storage estimate is unavailable in this browser.'}
                </p>
            </section>

            <section className="space-y-2">
                <h2 className="text-sm font-semibold">Clear data</h2>
                <p className="text-xs text-muted-foreground">
                    Remove all local feeds, posts, folders and settings. This cannot be undone.
                </p>
                <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void clearAll()}
                >
                    Clear all data
                </Button>
            </section>
        </div>
    )
}
