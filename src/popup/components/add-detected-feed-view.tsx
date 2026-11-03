import {useState} from 'react'
import {ArrowLeft} from 'lucide-react'
import type {DiscoveryFeed} from '@/background/discovery'
import {Button} from '@/components/ui/button'
import {ScrollArea} from '@/components/ui/scroll-area'
import {useFolders} from '../hooks/use-folders'
import {AddFeedForm} from '../settings/add-feed-form'

interface AddDetectedFeedViewProps {
    feeds: DiscoveryFeed[]
    tabId: number
    onAdded: () => void
    onCancel: () => void
}

export function AddDetectedFeedView({
    feeds,
    tabId,
    onAdded,
    onCancel
}: AddDetectedFeedViewProps) {
    const folders = useFolders()
    const [selectedUrl, setSelectedUrl] = useState(feeds[0]?.url ?? '')

    return (
        <div className="flex h-150 w-200 flex-col overflow-hidden bg-background text-foreground">
            <header className="flex h-13 shrink-0 items-center gap-2 border-b px-3">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onCancel}
                    aria-label="Back to reader"
                >
                    <ArrowLeft className="size-4"/>
                </Button>
                <span className="text-sm font-semibold">Add feed</span>
            </header>

            <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-5 p-4">
                    {feeds.length > 1 ? (
                        <section className="space-y-2">
                            <h2 className="text-sm font-semibold">Detected feeds</h2>
                            <div className="space-y-1 rounded-md border p-2">
                                {feeds.map((feed) => (
                                    <label
                                        key={feed.url}
                                        className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-muted"
                                    >
                                        <input
                                            type="radio"
                                            name="detected-feed"
                                            className="mt-0.5 size-4 accent-primary"
                                            checked={selectedUrl === feed.url}
                                            onChange={() => setSelectedUrl(feed.url)}
                                        />
                                        <span className="min-w-0">
                                            <span className="block truncate text-xs font-medium">
                                                {feed.title}
                                            </span>
                                            <span className="block truncate text-[11px] text-muted-foreground">
                                                {feed.type || 'Feed'} · {feed.url}
                                            </span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section className="space-y-2">
                        <h2 className="text-sm font-semibold">Feed options</h2>
                        <AddFeedForm
                            key={selectedUrl}
                            folders={folders ?? []}
                            initialUrl={selectedUrl}
                            sourceTabId={tabId}
                            onAdded={onAdded}
                            onCancel={onCancel}
                        />
                    </section>
                </div>
            </ScrollArea>
        </div>
    )
}
