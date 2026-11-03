import {Button} from '@/components/ui/button'
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
    return (
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
        </Button>
    )
}
