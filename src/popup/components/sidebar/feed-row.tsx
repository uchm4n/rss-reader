import {useState} from 'react'
import {Rss} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'
import type {Feed} from '@/db/types'
import {UnreadCount} from './unread-count'

interface FeedRowProps {
    feed: Feed
    selected: boolean
    onSelect: () => void
}

export function FeedRow({feed, selected, onSelect}: FeedRowProps) {
    const [iconFailed, setIconFailed] = useState(false)

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
            {feed.favicon && !iconFailed ? (
                <img
                    src={feed.favicon}
                    alt=""
                    loading="lazy"
                    onError={() => setIconFailed(true)}
                    className="size-4 shrink-0 rounded-sm"
                />
            ) : (
                <Rss className="size-4 shrink-0 text-muted-foreground group-hover:text-brand"/>
            )}
            <span className="min-w-0 flex-1 truncate">{feed.title}</span>
        </Button>
    )
}
