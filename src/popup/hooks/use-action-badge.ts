import {useEffect} from 'react'
import {syncActionBadge} from '@/background/badge'
import {totalUnread} from '@/shared/model/unread'
import {useFeeds} from './use-feeds'

export function useSyncActionBadge(): void {
    const feeds = useFeeds()
    const unread = totalUnread(feeds ?? [])

    useEffect(() => {
        void syncActionBadge()
    }, [unread])
}
