import {Inbox, Rss, Star} from 'lucide-react'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'
import type {Selection} from '@/shared/model/selection'
import {totalUnread} from '@/shared/model/unread'
import {useFeeds} from '../../hooks/use-feeds'

interface SmartViewsProps {
    selection: Selection
    onSelect: (selection: Selection) => void
}

const views = [
    {
        kind: 'all' as const,
        label: 'All posts',
        icon: Rss,
        hover: 'hover:bg-brand/10 hover:text-brand',
        active: 'bg-brand/15 text-brand'
    },
    {
        kind: 'unread' as const,
        label: 'Unread',
        icon: Inbox,
        hover: 'hover:bg-unread/10 hover:text-unread',
        active: 'bg-unread/15 text-unread'
    },
    {
        kind: 'starred' as const,
        label: 'Starred',
        icon: Star,
        hover: 'hover:bg-star/10 hover:text-star',
        active: 'bg-star/15 text-star'
    }
]

export function SmartViews({selection, onSelect}: SmartViewsProps) {
    const feeds = useFeeds()
    const unreadCount = totalUnread(feeds ?? [])

    return (
        <div className="space-y-0.5">
            {views.map((view) => {
                const Icon = view.icon
                const active = selection.kind === view.kind
                return (
                    <Button
                        key={view.kind}
                        variant="ghost"
                        size="sm"
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            'h-8 w-full justify-start gap-2 px-2 font-normal',
                            view.hover,
                            active && cn('font-medium', view.active)
                        )}
                        onClick={() => onSelect({kind: view.kind})}
                    >
                        <Icon className="size-4 shrink-0"/>
                        <span className="truncate">{view.label}</span>
                        {view.kind === 'unread' && unreadCount > 0 ? (
                            <Badge
                                variant="secondary"
                                className="ml-auto h-5 min-w-5 justify-center bg-unread/10 px-1 text-[10px] text-unread"
                            >
                                {unreadCount}
                            </Badge>
                        ) : null}
                    </Button>
                )
            })}
        </div>
    )
}
