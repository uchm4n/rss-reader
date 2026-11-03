import {AlertCircle} from 'lucide-react'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'

interface ErrorStateProps {
    error: Error | null
    onRetry: () => void
}

export function ErrorState({error, onRetry}: ErrorStateProps) {
    return (
        <div className="flex h-full items-center justify-center p-6">
            <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="size-4"/>
                <AlertTitle>Could not load posts</AlertTitle>
                <AlertDescription>
                    <p>{error?.message ?? 'Unknown error'}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        </div>
    )
}
