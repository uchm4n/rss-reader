import {useState} from 'react'
import {Rss} from 'lucide-react'
import {cn} from '@/lib/utils'

export function FeedIcon({
                             favicon,
                             className
                         }: {
    favicon: string | null
    className?: string
}) {
    const [failed, setFailed] = useState(false)

    if (!favicon || failed) {
        return <Rss className={cn('text-muted-foreground', className)}/>
    }

    return (
        <img
            src={favicon}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            className={cn('rounded-sm object-cover', className)}
        />
    )
}
