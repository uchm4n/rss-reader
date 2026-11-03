import type {ReactNode} from 'react'
import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'

interface EmptyStateProps {
    icon?: ReactNode
    title: string
    description?: string
    action?: string
    onAction?: () => void
    secondaryAction?: string
    onSecondaryAction?: () => void
    className?: string
}

export function EmptyState({
                               icon,
                               title,
                               description,
                               action,
                               onAction,
                               secondaryAction,
                               onSecondaryAction,
                               className
                           }: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex h-full flex-col items-center justify-center gap-4 p-8 text-center',
                className
            )}
        >
            {icon ? (
                <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {icon}
                </div>
            ) : null}
            <div className="space-y-1">
                <h2 className="text-base font-semibold">{title}</h2>
                {description ? (
                    <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
                ) : null}
            </div>
            {(action || secondaryAction) && (
                <div className="flex items-center gap-2">
                    {action && onAction ? <Button onClick={onAction}>{action}</Button> : null}
                    {secondaryAction && onSecondaryAction ? (
                        <Button variant="outline" onClick={onSecondaryAction}>
                            {secondaryAction}
                        </Button>
                    ) : null}
                </div>
            )}
        </div>
    )
}
