import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {formatRelativeTime} from '@/shared/model/post'
import {
    fetchHnThread,
    HN_ITEM_URL,
    HN_VISIBLE_COMMENTS,
    type HnComment,
    type HnThread
} from '../../lib/hn-content'
import {useDiscussionEntries} from '../../hooks/use-discussion-entries'
import {useDiscussionThread} from '../../hooks/use-discussion-thread'
import {DiscussionComment} from './discussion-comment'
import {PostBody} from './post-body'

const HN_USER_URL = 'https://news.ycombinator.com/user?id='

function HnCommentItem({
    comment,
    depth,
    collapsed,
    onToggle
}: {
    comment: HnComment
    depth: number
    collapsed: boolean
    onToggle: () => void
}) {
    const text = comment.text?.trim()
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
                            href={`${HN_USER_URL}${encodeURIComponent(comment.author)}`}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            {comment.author}
                        </a>
                    ) : (
                        <span>[deleted]</span>
                    )}
                    {createdAt ? (
                        <>
                            <span aria-hidden="true">·</span>
                            <a
                                href={`${HN_ITEM_URL}${comment.id}`}
                                target="_blank"
                                rel="noreferrer noopener"
                            >
                                {formatRelativeTime(createdAt)}
                            </a>
                        </>
                    ) : null}
                </>
            }
        >
            {text ? (
                <PostBody content={text} contentType="html"/>
            ) : (
                <p className="discussion-comment-deleted">[deleted]</p>
            )}
        </DiscussionComment>
    )
}

export function HnThreadView({
    thread,
    initialLimit = HN_VISIBLE_COMMENTS
}: {
    thread: HnThread
    initialLimit?: number
}) {
    const [visible, setVisible] = useState(initialLimit)
    const {entries, visibleEntries, collapsed, toggle} = useDiscussionEntries(
        thread.comments
    )
    const shown = visibleEntries.slice(0, visible)
    const remaining = visibleEntries.length - shown.length

    return (
        <section
            className="discussion-section hn-discussion"
            aria-label="Hacker News discussion"
        >
            <div className="discussion-meta">
                {thread.points !== null ? <span>{thread.points} points</span> : null}
                {thread.author ? <span>by {thread.author}</span> : null}
                <span>
                    {entries.length} {entries.length === 1 ? 'comment' : 'comments'}
                </span>
                <a
                    href={`${HN_ITEM_URL}${thread.id}`}
                    target="_blank"
                    rel="noreferrer noopener"
                >
                    View on Hacker News
                </a>
            </div>

            {thread.text ? (
                <div className="hn-story-text">
                    <PostBody content={thread.text} contentType="html"/>
                </div>
            ) : null}

            {entries.length ? (
                <div className="discussion-comments">
                    {shown.map(({comment, depth}) => (
                        <HnCommentItem
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

            {remaining > 0 ? (
                <Button
                    variant="outline"
                    size="sm"
                    className="discussion-more"
                    onClick={() => setVisible((value) => value + HN_VISIBLE_COMMENTS)}
                >
                    Show {remaining} more {remaining === 1 ? 'comment' : 'comments'}
                </Button>
            ) : null}
        </section>
    )
}

export function HnDiscussion({itemId}: { itemId: number }) {
    const {state} = useDiscussionThread(
        (signal) => fetchHnThread(itemId, {signal}),
        [itemId]
    )

    if (state.status === 'ready') {
        return <HnThreadView thread={state.thread}/>
    }

    return (
        <section
            className="discussion-section hn-discussion"
            aria-label="Hacker News discussion"
        >
            {state.status === 'loading' ? (
                <p className="discussion-status">Loading discussion…</p>
            ) : (
                <p className="discussion-status">
                    Couldn&apos;t load the discussion.{' '}
                    <a
                        href={`${HN_ITEM_URL}${itemId}`}
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        View on Hacker News
                    </a>
                </p>
            )}
        </section>
    )
}
