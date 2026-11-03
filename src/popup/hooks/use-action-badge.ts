import {useEffect} from 'react'
import {totalUnread} from '@/shared/model/unread'
import {sendCommand} from '../lib/commands'
import {useFeeds} from './use-feeds'

export function useSyncActionBadge(): void {
    const feeds = useFeeds()
    const unread = totalUnread(feeds ?? [])

    useEffect(() => {
        void sendCommand({type: 'action:refresh'}).catch(() => {
            // The background may be restarting; the next live-query change retries.
        })
    }, [unread])
}
