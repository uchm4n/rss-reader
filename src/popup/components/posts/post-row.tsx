import {Star} from 'lucide-react'
import {cn} from '@/lib/utils'
import type {Feed, Post} from '@/db/types'
import {formatRelativeTime} from '@/shared/model/post'
import {FeedIcon} from './feed-icon'

interface PostRowProps {
    post: Post
    feed?: Feed
    onOpen: () => void
    onToggleStar: () => void
}

export function PostRow({post, feed, onOpen, onToggleStar}: PostRowProps) {
    return (
        <div
            className={cn(
                'flex w-full items-start gap-3 px-4 py-3.5 transition-colors hover:bg-brand/5',
                !post.status && 'bg-muted/30'
            )}
        >
            <button
                type="button"
                onClick={onOpen}
                className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
            >
        <span
            className={cn(
                'mt-1.5 size-2 shrink-0 rounded-full',
                post.status ? 'bg-transparent' : 'bg-unread'
            )}
            aria-hidden="true"
        />

                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <FeedIcon favicon={feed?.favicon ?? null} className="size-4"/>
        </span>

                <span className="min-w-0 flex-1 overflow-hidden">
                <span className="line-clamp-2 wrap-break-word text-sm font-medium leading-5">{post.title}</span>

                    {post.excerpt ? (
                        <span
                            className="mt-1 line-clamp-2 wrap-break-word text-xs leading-5 text-muted-foreground">
                        {post.excerpt}
                    </span>
                    ) : null}

                    <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {feed?.title ? (<span className="max-w-40 truncate">{feed.title}</span>) : null}
                        {feed?.title ? <span aria-hidden="true">·</span> : null}
                        <span>{formatRelativeTime(new Date(post.publishedAt))}</span>
                </span>
            </span>

                {post.imageUrl ? (
                    <img
                        src={post.imageUrl}
                        alt=""
                        loading="lazy"
                        className="mt-0.5 size-14 shrink-0 rounded-md object-cover"
                    />
                ) : null}
            </button>

            <button
                type="button"
                aria-label={post.starred ? 'Unstar post' : 'Star post'}
                onClick={onToggleStar}
                className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-star/10 hover:text-star"
            >
                <Star
                    className={
                        post.starred ? 'size-4 fill-current text-star' : 'size-4'
                    }
                />
            </button>
        </div>
    )
}
