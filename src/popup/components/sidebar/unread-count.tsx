import {cn} from '@/lib/utils'

export function UnreadCount({count}: { count: number }) {
    return (
        <span
            className={cn(
                'w-5 shrink-0 text-left text-[10px] leading-none tabular-nums',
                count > 0 ? 'font-semibold text-amber-600' : 'text-muted-foreground'
            )}
        >
      {count > 0 ? count : ''}
    </span>
    )
}
