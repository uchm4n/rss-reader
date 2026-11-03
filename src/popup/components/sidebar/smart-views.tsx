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
    {kind: 'all' as const, label: 'All posts', icon: Rss},
    {kind: 'unread' as const, label: 'Unread', icon: Inbox},
    {kind: 'starred' as const, label: 'Starred', icon: Star}
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
                            active && 'bg-accent text-accent-foreground font-medium'
                        )}
                        onClick={() => onSelect({kind: view.kind})}
                    >
                        <Icon className="size-4 shrink-0"/>
                        <span className="truncate">{view.label}</span>
                        {view.kind === 'unread' && unreadCount > 0 ? (
                            <Badge
                                variant="secondary"
                                className="ml-auto h-5 min-w-5 justify-center px-1 text-[10px]"
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
