import {useEffect, useState} from 'react'
import {useLiveQuery} from 'dexie-react-hooks'
import {toast} from 'sonner'
import {Button} from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import {sendCommand} from '../lib/commands'
import {formatBytes, loadStoreSummary, usagePercent} from '../lib/storage'

interface StorageEstimate {
    usage: number
    quota: number
}

function Stat({label, value}: { label: string; value: string }) {
    return (
        <div className="rounded-md border p-2">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums">{value}</dd>
        </div>
    )
}

export function StorageSettings() {
    const stores = useLiveQuery(loadStoreSummary, [])
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

    const totalRecords = stores?.reduce((total, store) => total + store.count, 0) ?? 0
    const used = estimate ? usagePercent(estimate.usage, estimate.quota) : 0

    return (
        <div className="space-y-5">
            <section className="space-y-2">
                <h2 className="text-sm font-semibold">IndexedDB</h2>
                <div className="overflow-hidden rounded-md border">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="h-8 px-3 text-[11px]">Store</TableHead>
                                <TableHead className="h-8 px-3 text-right text-[11px]">
                                    Records
                                </TableHead>
                                <TableHead className="h-8 px-3 text-[11px]">
                                    Contents
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stores ? (
                                stores.map((store) => (
                                    <TableRow key={store.name}>
                                        <TableCell className="px-3 py-1.5 font-medium">
                                            {store.label}
                                        </TableCell>
                                        <TableCell className="px-3 py-1.5 text-right tabular-nums">
                                            {store.count.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="px-3 py-1.5 text-muted-foreground">
                                            {store.description}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={3}
                                        className="px-3 py-2 text-muted-foreground"
                                    >
                                        Loading…
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </section>

            <section className="space-y-2">
                <h2 className="text-sm font-semibold">Statistics</h2>
                <dl className="grid grid-cols-2 gap-2">
                    <Stat label="Total records" value={totalRecords.toLocaleString()}/>
                    <Stat
                        label="Storage used"
                        value={estimate ? formatBytes(estimate.usage) : 'Unavailable'}
                    />
                    <Stat
                        label="Available quota"
                        value={estimate ? formatBytes(estimate.quota) : 'Unavailable'}
                    />
                    <Stat
                        label="Used"
                        value={estimate ? `${used.toFixed(1)}%` : 'Unavailable'}
                    />
                </dl>
            </section>

            <section className="space-y-2 border-t pt-4">
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
