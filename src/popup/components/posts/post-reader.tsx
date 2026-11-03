import {ArrowLeft, ExternalLink, Star} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Skeleton} from '@/components/ui/skeleton'
import type {Feed, Post} from '@/db/types'
import {formatRelativeTime} from '@/shared/model/post'
import {useFeeds} from '../../hooks/use-feeds'
import {usePost} from '../../hooks/use-post'
import {setPostStatus, togglePostStar} from '../../hooks/use-post-actions'
import {FeedIcon} from './feed-icon'
import {PostBody} from './post-body'

interface PostReaderProps {
    postId: string
    onBack: () => void
    onOpenOriginal: (url: string) => void
}

function ReaderSkeleton({onBack}: { onBack: () => void }) {
    return (
        <div className="flex h-full flex-col">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
                <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to posts">
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

export function ReaderHeader({
                                 post,
                                 feed,
                                 onBack,
                                 onOpenOriginal,
                                 onToggleStar,
                                 onMarkRead,
                                 onMarkUnread
                             }: {
    post: Post
    feed?: Feed
    onBack: () => void
    onOpenOriginal: (url: string) => void
    onToggleStar: () => void
    onMarkRead: () => void
    onMarkUnread: () => void
}) {
    return (
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to posts">
                <ArrowLeft className="size-4"/>
            </Button>

            <div className="flex min-w-0 items-center gap-2">
                <FeedIcon favicon={feed?.favicon ?? null} className="size-4"/>
                <span className="truncate text-xs text-muted-foreground">
          {feed?.title || 'Post'}
        </span>
            </div>

            <div className="ml-auto flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onToggleStar}
                    aria-label={post.starred ? 'Unstar post' : 'Star post'}
                >
                    <Star
                        className={
                            post.starred ? 'size-4 fill-current text-amber-500' : 'size-4'
                        }
                    />
                </Button>
                {post.status ? (
                    <Button variant="ghost" size="sm" onClick={onMarkUnread}>
                        Mark unread
                    </Button>
                ) : (
                    <Button variant="ghost" size="sm" onClick={onMarkRead}>
                        Mark read
                    </Button>
                )}
                {post.link ? (
                    <Button variant="ghost" size="sm" onClick={() => onOpenOriginal(post.link!)}>
                        <ExternalLink className="size-4"/>
                        Open original
                    </Button>
                ) : null}
            </div>
        </div>
    )
}

export function PostReader({postId, onBack, onOpenOriginal}: PostReaderProps) {
    const post = usePost(postId)
    const feeds = useFeeds()
    const feed = feeds?.find((candidate) => candidate.id === post?.feedId)

    if (!post) return <ReaderSkeleton onBack={onBack}/>

    const markRead = async () => {
        await setPostStatus(post.id, true)
    }

    const markUnread = async () => {
        await setPostStatus(post.id, false)
        onBack()
    }

    return (
        <div className="flex h-full min-w-0 flex-col">
            <ReaderHeader
                post={post}
                feed={feed}
                onBack={onBack}
                onOpenOriginal={onOpenOriginal}
                onToggleStar={() => void togglePostStar(post.id)}
                onMarkRead={() => void markRead()}
                onMarkUnread={() => void markUnread()}
            />
            <ScrollArea
                className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block [&_[data-slot=scroll-area-viewport]>div]:!w-full">
                <article className="mx-auto w-full min-w-0 max-w-2xl px-6 py-5">
                    <h1 className="text-xl font-semibold leading-tight [overflow-wrap:anywhere]">
                        {post.title}
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

                    {post.contentHtml ? (
                        <div className="mt-5 min-w-0">
                            <PostBody
                                content={post.contentHtml}
                                contentType={post.contentType}
                            />
                        </div>
                    ) : (
                        <div className="mt-5 space-y-4">
                            <p className="text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                                {post.excerpt || 'No content available for this post.'}
                            </p>
                            {post.link ? (
                                <Button onClick={() => onOpenOriginal(post.link!)}>Read on site</Button>
                            ) : null}
                        </div>
                    )}
                </article>
            </ScrollArea>
        </div>
    )
}
