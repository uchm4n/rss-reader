import {useMemo} from 'react'
import {Inbox, Star} from 'lucide-react'
import {ScrollArea} from '@/components/ui/scroll-area'
import type {Feed} from '@/db/types'
import type {Selection} from '@/shared/model/selection'
import {useFeeds} from '../../hooks/use-feeds'
import {usePosts} from '../../hooks/use-posts'
import {useSettings} from '../../hooks/use-settings'
import {setPostStatus, togglePostStar} from '../../hooks/use-post-actions'
import {EmptyState} from '../empty-state'
import {LoadingRows} from '../loading-rows'
import {PostRow} from './post-row'

interface PostListProps {
    selection: Selection
    onOpenPost: (postId: string) => void
}

function emptyCopy(selection: Selection): { title: string; description: string } {
    switch (selection.kind) {
        case 'unread':
            return {title: 'No unread posts', description: 'You are caught up.'}
        case 'starred':
            return {title: 'No starred posts', description: 'Star a post to keep it here.'}
        case 'feed':
            return {title: 'No posts in this feed', description: 'Try another feed or refresh.'}
        case 'folder':
            return {title: 'No posts in this folder', description: 'Try another folder or refresh.'}
        case 'search':
            return {
                title: `No results for “${selection.query}”`,
                description: 'Try a different search term.'
            }
        case 'all':
            return {title: 'No posts', description: 'Add a feed or refresh to load posts.'}
    }
}

export function PostList({selection, onOpenPost}: PostListProps) {
    const posts = usePosts(selection)
    const feeds = useFeeds()
    const settings = useSettings()
    const feedsById = useMemo(
        () => new Map((feeds ?? []).map((feed) => [feed.id, feed])),
        [feeds]
    )

    if (!posts) return <LoadingRows rows={8}/>

    if (!posts.length) {
        const copy = emptyCopy(selection)
        return (
            <EmptyState
                icon={
                    selection.kind === 'starred' ? <Star className="size-5"/> : <Inbox className="size-5"/>
                }
                title={copy.title}
                description={copy.description}
            />
        )
    }

    return (
        <div className="flex h-full flex-col">
            <div
                className="flex h-9 shrink-0 items-center justify-between border-b px-4 text-[11px] text-muted-foreground">
        <span>
          {posts.length} {posts.length === 1 ? 'post' : 'posts'}
        </span>
                <span>Newest first</span>
            </div>
            <ScrollArea className="min-h-0 flex-1">
                <div className="divide-y">
                    {posts.map((post) => {
                        const feed: Feed | undefined = feedsById.get(post.feedId)
                        return (
                            <PostRow
                                key={post.id}
                                post={post}
                                feed={feed}
                                onOpen={() => {
                                    if (!post.status && (settings?.markReadOnOpen ?? true)) {
                                        void setPostStatus(post.id, true)
                                    }
                                    onOpenPost(post.id)
                                }}
                                onToggleStar={() => void togglePostStar(post.id)}
                            />
                        )
                    })}
                </div>
            </ScrollArea>
        </div>
    )
}
