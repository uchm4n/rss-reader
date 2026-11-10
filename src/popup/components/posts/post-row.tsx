import {useMemo} from 'react'
import {Star} from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/components/ui/tooltip'
import {cn} from '@/lib/utils'
import type {Feed, Post} from '@/db/types'
import {findMatchedWords} from '@/shared/model/match-words'
import {formatRelativeTime} from '@/shared/model/post'
import {FeedIcon} from './feed-icon'
import {HighlightedText} from './highlighted-text'

interface PostRowProps {
    post: Post
    feed?: Feed
    onOpen: () => void
    onToggleStar: () => void
}

export function PostRow({post, feed, onOpen, onToggleStar}: PostRowProps) {
    const matchedWords = useMemo(
        () => findMatchedWords(feed?.matchWords, [post]),
        [post, feed?.matchWords]
    )
    const hasMatch = matchedWords.length > 0

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
                    data-slot="post-dot-slot"
                    className="mt-1.5 flex size-2 shrink-0 items-center"
                    aria-hidden={hasMatch ? undefined : true}
                >
                    <span className="flex -space-x-0.5">
                        {!post.status ? (
                            <span
                                data-slot="post-unread-dot"
                                className="relative z-10 size-2 rounded-full bg-unread ring-2 ring-background"
                                aria-hidden="true"
                            />
                        ) : null}
                        {hasMatch ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span
                                        data-slot="post-match-dot"
                                        role="img"
                                        aria-label={`Matched: ${matchedWords.join(', ')}`}
                                        className="relative z-0 size-2 rounded-full bg-star ring-2 ring-background"
                                    />
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={4}>
                                    Matched: {matchedWords.join(', ')}
                                </TooltipContent>
                            </Tooltip>
                        ) : null}
                    </span>
                </span>

                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <FeedIcon favicon={feed?.favicon ?? null} className="size-4"/>
        </span>

                <span className="min-w-0 flex-1 overflow-hidden">
                <span className="line-clamp-2 wrap-break-word text-sm font-medium leading-5">
                    <HighlightedText text={post.title} words={feed?.matchWords}/>
                </span>

                    {post.excerpt ? (
                        <span
                            className="mt-1 line-clamp-2 wrap-break-word text-xs leading-5 text-muted-foreground">
                        <HighlightedText text={post.excerpt} words={feed?.matchWords}/>
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
