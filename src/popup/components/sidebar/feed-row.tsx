import {Tag} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/components/ui/tooltip'
import {cn} from '@/lib/utils'
import type {Feed} from '@/db/types'
import {FeedIcon} from '../posts/feed-icon'
import {UnreadCount} from './unread-count'

interface FeedRowProps {
    feed: Feed
    selected: boolean
    onSelect: () => void
}

export function FeedRow({feed, selected, onSelect}: FeedRowProps) {
    const matched = feed.matchedWords ?? []
    const row = (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSelect}
            aria-current={selected ? 'page' : undefined}
            className={cn(
                'group h-8 w-full justify-start gap-1.5 rounded-md pl-1! pr-2! text-left font-normal hover:bg-brand/5',
                selected && 'bg-accent text-accent-foreground font-medium'
            )}
        >
            <UnreadCount count={feed.unreadCount}/>
            <FeedIcon
                favicon={feed.favicon}
                className="size-4 shrink-0 group-hover:text-brand"
            />
            <span className="min-w-0 flex-1 truncate">{feed.title}</span>
            {matched.length ? (
                <>
                    <span
                        aria-hidden="true"
                        className="flex shrink-0 items-center gap-0.5 rounded-full bg-star/20 px-1 py-0.5 text-[9px] font-semibold leading-none text-foreground"
                    >
                        <Tag className="size-2.5 text-star"/>
                        {matched.length > 1 ? matched.length : null}
                    </span>
                    <span className="sr-only">Matches: {matched.join(', ')}</span>
                </>
            ) : null}
        </Button>
    )

    if (!matched.length) return row

    return (
        <Tooltip>
            <TooltipTrigger asChild>{row}</TooltipTrigger>
            <TooltipContent side="right">Matches: {matched.join(', ')}</TooltipContent>
        </Tooltip>
    )
}
