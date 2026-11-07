import {useEffect} from 'react'
import {useLiveQuery} from 'dexie-react-hooks'
import {X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Skeleton} from '@/components/ui/skeleton'
import {
    TOOLTIP_DELAY_MS,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip'
import {db} from '@/db/db'
import {useFeeds} from '../../hooks/use-feeds'
import {useTheme} from '../../hooks/use-theme'
import {closePinnedPostWindow} from '../../lib/pinned-post'
import {openExternal} from '../../platform'
import {FeedIcon} from './feed-icon'
import {PostArticle} from './post-reader'

function PinnedLoading() {
    return (
        <div className="mx-auto w-full max-w-2xl space-y-4 px-6 py-5">
            <Skeleton className="h-7 w-3/4"/>
            <Skeleton className="h-4 w-40"/>
            <div className="space-y-2 pt-3">
                <Skeleton className="h-4 w-full"/>
                <Skeleton className="h-4 w-full"/>
                <Skeleton className="h-4 w-5/6"/>
                <Skeleton className="h-4 w-2/3"/>
            </div>
        </div>
    )
}

function PinnedMissing({onClose}: { onClose: () => void }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
                This post is no longer available.
            </p>
            <Button size="sm" onClick={onClose}>
                Close
            </Button>
        </div>
    )
}

export function PinnedPostWindow({postId}: { postId: string }) {
    useTheme()
    const post = useLiveQuery(
        async () => (await db.posts.get(postId)) ?? null,
        [postId]
    )
    const feeds = useFeeds()
    const feed = feeds?.find((candidate) => candidate.id === post?.feedId)

    const close = () => {
        void closePinnedPostWindow(postId).catch(() => window.close())
    }

    useEffect(() => {
        document.title = post?.title || 'RSS Reader'
    }, [post?.title])

    return (
        <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
            <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
                <header className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
                    <FeedIcon favicon={feed?.favicon ?? null} className="size-4"/>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {feed?.title || 'Pinned post'}
                    </span>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={close}
                                aria-label="Close pinned window"
                                className="hover:bg-destructive/10 hover:text-destructive"
                            >
                                <X className="size-4"/>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Close</TooltipContent>
                    </Tooltip>
                </header>

                {post === undefined ? (
                    <PinnedLoading/>
                ) : post === null ? (
                    <PinnedMissing onClose={close}/>
                ) : (
                    <ScrollArea
                        className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block [&_[data-slot=scroll-area-viewport]>div]:!w-full">
                        <PostArticle
                            post={post}
                            feed={feed}
                            onOpenOriginal={openExternal}
                        />
                    </ScrollArea>
                )}
            </div>
        </TooltipProvider>
    )
}
