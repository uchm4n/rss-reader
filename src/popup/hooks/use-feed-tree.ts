import {useMemo} from 'react'
import {buildFeedTree, type FeedTreeNode} from '@/shared/model/feed-tree'
import {useFeeds} from './use-feeds'
import {useFolders} from './use-folders'

export function useFeedTree(): FeedTreeNode[] {
    const feeds = useFeeds()
    const folders = useFolders()

    return useMemo(
        () => (feeds && folders ? buildFeedTree(feeds, folders) : []),
        [feeds, folders]
    )
}
