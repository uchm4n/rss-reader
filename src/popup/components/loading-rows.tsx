import {Skeleton} from '@/components/ui/skeleton'

export function LoadingRows({rows = 6}: { rows?: number }) {
    return (
        <div className="space-y-3 p-4">
            {Array.from({length: rows}).map((_, index) => (
                <div key={index} className="flex gap-3">
                    <Skeleton className="size-5 shrink-0 rounded"/>
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4"/>
                        <Skeleton className="h-3 w-full"/>
                        <Skeleton className="h-3 w-1/3"/>
                    </div>
                </div>
            ))}
        </div>
    )
}
