import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {formatRelativeTime} from '@/shared/model/post'
import {
    fetchRedditThread,
    REDDIT_INITIAL_COMMENTS,
    REDDIT_MAX_COMMENTS,
    type RedditComment,
    type RedditThread
} from '../../lib/reddit-comments'
import {useDiscussionEntries} from '../../hooks/use-discussion-entries'
import {useDiscussionThread} from '../../hooks/use-discussion-thread'
import {DiscussionComment} from './discussion-comment'
import {PostBody} from './post-body'

const REDDIT_USER_URL = 'https://www.reddit.com/user/'

function RedditCommentItem({
    comment,
    depth,
    collapsed,
    onToggle
}: {
    comment: RedditComment
    depth: number
    collapsed: boolean
    onToggle: () => void
}) {
    const createdAt = comment.createdAt > 0 ? new Date(comment.createdAt) : null

    return (
        <DiscussionComment
            depth={depth}
            hasReplies={comment.children.length > 0}
            collapsed={collapsed}
            onToggle={onToggle}
            meta={
                <>
                    {comment.author ? (
                        <a
                            className="discussion-comment-author"
                            href={`${REDDIT_USER_URL}${encodeURIComponent(comment.author)}`}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            u/{comment.author}
                        </a>
                    ) : (
                        <span>[deleted]</span>
                    )}
                    {comment.score !== null ? (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>{comment.score} points</span>
                        </>
                    ) : null}
                    {createdAt ? (
                        <>
                            <span aria-hidden="true">·</span>
                            {comment.permalink ? (
                                <a
                                    href={comment.permalink}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                >
                                    {formatRelativeTime(createdAt)}
                                </a>
                            ) : (
                                <span>{formatRelativeTime(createdAt)}</span>
                            )}
                        </>
                    ) : null}
                </>
            }
        >
            {comment.bodyHtml?.trim() ? (
                <PostBody content={comment.bodyHtml} contentType="html"/>
            ) : (
                <p className="discussion-comment-deleted">[deleted]</p>
            )}
        </DiscussionComment>
    )
}

export function RedditThreadView({
    thread,
    limit,
    refreshing,
    refreshError,
    onLoadMore
}: {
    thread: RedditThread
    limit: number
    refreshing: boolean
    refreshError: boolean
    onLoadMore: () => void
}) {
    const {entries, visibleEntries, collapsed, toggle} = useDiscussionEntries(
        thread.comments
    )
    const total = thread.totalComments
    const countLabel =
        total !== null && total > entries.length
            ? `${entries.length} of ${total} comments`
            : `${entries.length} ${entries.length === 1 ? 'comment' : 'comments'}`
    const atMax = limit >= REDDIT_MAX_COMMENTS

    return (
        <section
            className="discussion-section reddit-discussion"
            aria-label="Reddit discussion"
        >
            <div className="discussion-meta">
                <span>{countLabel}</span>
                <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={onLoadMore}
                    disabled={refreshing}
                    aria-busy={refreshing}
                >
                    {atMax ? 'Refresh' : 'Load more'}
                </Button>
            </div>

            {refreshError ? (
                <p className="discussion-status">Couldn’t refresh comments.</p>
            ) : null}

            {entries.length ? (
                <div className="discussion-comments">
                    {visibleEntries.map(({comment, depth}) => (
                        <RedditCommentItem
                            key={comment.id}
                            comment={comment}
                            depth={depth}
                            collapsed={collapsed.has(comment.id)}
                            onToggle={() => toggle(comment.id)}
                        />
                    ))}
                </div>
            ) : (
                <p className="discussion-status">No comments yet.</p>
            )}
        </section>
    )
}

export function RedditDiscussion({postId}: { postId: string }) {
    const [limit, setLimit] = useState(REDDIT_INITIAL_COMMENTS)
    const {state, reload} = useDiscussionThread(
        (signal) => fetchRedditThread(postId, {limit, signal}),
        [postId, limit]
    )

    const loadMore = () => {
        if (limit < REDDIT_MAX_COMMENTS) setLimit(REDDIT_MAX_COMMENTS)
        else reload()
    }

    if (state.status === 'ready') {
        return (
            <RedditThreadView
                thread={state.thread}
                limit={limit}
                refreshing={state.refreshing}
                refreshError={state.refreshError}
                onLoadMore={loadMore}
            />
        )
    }

    return (
        <section
            className="discussion-section reddit-discussion"
            aria-label="Reddit discussion"
        >
            {state.status === 'loading' ? (
                <p className="discussion-status">Loading discussion…</p>
            ) : (
                <div className="space-y-2">
                    <p className="discussion-status">
                        Couldn’t load the discussion.{' '}
                        <a
                            href={`https://www.reddit.com/comments/${postId}`}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            View on Reddit
                        </a>
                    </p>
                    <Button variant="outline" size="sm" onClick={reload}>
                        Try again
                    </Button>
                </div>
            )}
        </section>
    )
}
