import type {ReactNode} from 'react'
import {toast} from 'sonner'
import {ArrowLeft, ExternalLink, MessageSquareDot, Pin, Star} from 'lucide-react'
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
import type {Feed, Post} from '@/db/types'
import {formatRelativeTime} from '@/shared/model/post'
import {useFeeds} from '../../hooks/use-feeds'
import {usePost} from '../../hooks/use-post'
import {setPostStatus, togglePostStar} from '../../hooks/use-post-actions'
import {hnItemId, isHnCommentsOnly} from '../../lib/hn-content'
import {openPinnedPost} from '../../lib/pinned-post'
import {redditPostId} from '../../lib/reddit-content'
import {FeedIcon} from './feed-icon'
import {HighlightedText} from './highlighted-text'
import {HnDiscussion} from './hn-discussion'
import {PostBody} from './post-body'
import {RedditDiscussion} from './reddit-discussion'

interface PostReaderProps {
    postId: string
    onBack: () => void
    onOpenOriginal: (url: string) => void
}

function ReaderSkeleton({onBack}: { onBack: () => void }) {
    return (
        <div className="flex h-full flex-col">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onBack}
                    aria-label="Back to posts"
                    className="hover:bg-brand/10 hover:text-brand"
                >
                    <ArrowLeft className="size-4"/>
                </Button>
                <Skeleton className="h-4 w-32"/>
            </div>
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
        </div>
    )
}

function HeaderAction({
                          label,
                          onClick,
                          className,
                          children
                      }: {
    label: string
    onClick: () => void
    className: string
    children: ReactNode
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onClick}
                    aria-label={label}
                    className={className}
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
        </Tooltip>
    )
}

export function ReaderHeader({
                                 post,
                                 feed,
                                 onBack,
                                 onOpenOriginal,
                                 onToggleStar,
                                 onMarkUnread,
                                 onPin
                             }: {
    post: Post
    feed?: Feed
    onBack: () => void
    onOpenOriginal: (url: string) => void
    onToggleStar: () => void
    onMarkUnread: () => void
    onPin: () => void
}) {
    return (
        <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
            <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
                <HeaderAction
                    label="Back to posts"
                    onClick={onBack}
                    className="hover:bg-brand/10 hover:text-brand"
                >
                    <ArrowLeft className="size-4"/>
                </HeaderAction>

                <div className="flex min-w-0 items-center gap-2">
                    <FeedIcon favicon={feed?.favicon ?? null} className="size-4"/>
                    <span className="truncate text-xs text-muted-foreground">
          {feed?.title || 'Post'}
        </span>
                </div>

                <div className="ml-auto flex items-center gap-1">
                    <HeaderAction
                        label="Open pinned post"
                        onClick={onPin}
                        className="hover:bg-brand/10 hover:text-brand"
                    >
                        <Pin className="size-4"/>
                    </HeaderAction>
                    <HeaderAction
                        label={post.starred ? 'Unstar post' : 'Star post'}
                        onClick={onToggleStar}
                        className="hover:bg-star/10 hover:text-star"
                    >
                        <Star
                            className={
                                post.starred ? 'size-4 fill-current text-star' : 'size-4'
                            }
                        />
                    </HeaderAction>
                    <HeaderAction
                        label="Mark unread"
                        onClick={onMarkUnread}
                        className="hover:bg-brand/10 hover:text-brand"
                    >
                        <MessageSquareDot className="size-4"/>
                    </HeaderAction>
                    {post.link ? (
                        <HeaderAction
                            label="Open original"
                            onClick={() => onOpenOriginal(post.link!)}
                            className="hover:bg-refresh/10 hover:text-refresh"
                        >
                            <ExternalLink className="size-4"/>
                        </HeaderAction>
                    ) : null}
                </div>
            </div>
        </TooltipProvider>
    )
}

export function PostArticle({
                                post,
                                feed,
                                onOpenOriginal
                            }: {
    post: Post
    feed?: Feed
    onOpenOriginal: (url: string) => void
}) {
    const hnId = hnItemId(post)
    const redditId = hnId === null ? redditPostId(post) : null
    const commentsOnly = hnId !== null && isHnCommentsOnly(post.contentHtml)

    return (
        <article className="mx-auto w-full min-w-0 max-w-2xl px-6 py-5">
            <h1 className="text-xl font-semibold leading-tight [overflow-wrap:anywhere]">
                <HighlightedText text={post.title} words={feed?.matchWords}/>
            </h1>
            <div
                className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                <span>{formatRelativeTime(new Date(post.publishedAt))}</span>
                {feed?.title ? (
                    <>
                        <span aria-hidden="true">·</span>
                        <span>{feed.title}</span>
                    </>
                ) : null}
            </div>

            {post.contentHtml && !commentsOnly ? (
                <div className="mt-5 min-w-0">
                    <PostBody
                        content={post.contentHtml}
                        contentType={post.contentType}
                        imageUrl={post.imageUrl}
                        matchWords={feed?.matchWords}
                    />
                </div>
            ) : hnId === null ? (
                <div className="mt-5 space-y-4">
                    <p className="text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                        {post.excerpt ? (
                            <HighlightedText text={post.excerpt} words={feed?.matchWords}/>
                        ) : (
                            'No content available for this post.'
                        )}
                    </p>
                    {post.link ? (
                        <Button onClick={() => onOpenOriginal(post.link!)}>Read on site</Button>
                    ) : null}
                </div>
            ) : null}

            {hnId !== null ? (
                <HnDiscussion key={hnId} itemId={hnId}/>
            ) : redditId !== null ? (
                <RedditDiscussion key={redditId} postId={redditId}/>
            ) : null}
        </article>
    )
}

export function PostReader({postId, onBack, onOpenOriginal}: PostReaderProps) {
    const post = usePost(postId)
    const feeds = useFeeds()
    const feed = feeds?.find((candidate) => candidate.id === post?.feedId)

    if (!post) return <ReaderSkeleton onBack={onBack}/>

    const markUnread = async () => {
        await setPostStatus(post.id, false)
        onBack()
    }

    const pin = () => {
        void openPinnedPost(post.id).catch((error) => {
            toast.error(
                error instanceof Error ? error.message : 'Could not open pinned window'
            )
        })
    }

    return (
        <div className="flex h-full min-w-0 flex-col">
            <ReaderHeader
                post={post}
                feed={feed}
                onBack={onBack}
                onOpenOriginal={onOpenOriginal}
                onToggleStar={() => void togglePostStar(post.id)}
                onMarkUnread={() => void markUnread()}
                onPin={pin}
            />
            <ScrollArea
                className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block [&_[data-slot=scroll-area-viewport]>div]:!w-full">
                <PostArticle post={post} feed={feed} onOpenOriginal={onOpenOriginal}/>
            </ScrollArea>
        </div>
    )
}
