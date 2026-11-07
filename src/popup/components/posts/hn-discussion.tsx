import {useEffect, useMemo, useState} from 'react'
import {Button} from '@/components/ui/button'
import {formatRelativeTime} from '@/shared/model/post'
import {
    fetchHnThread,
    flattenHnComments,
    HN_ITEM_URL,
    HN_VISIBLE_COMMENTS,
    type HnComment,
    type HnThread
} from '../../lib/hn-content'
import {PostBody} from './post-body'

const HN_USER_URL = 'https://news.ycombinator.com/user?id='
const MAX_DEPTH_INDENT = 8
const INDENT_PX = 12

type DiscussionState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; thread: HnThread }

function useHnThread(itemId: number): DiscussionState {
    const [state, setState] = useState<DiscussionState>({status: 'loading'})

    useEffect(() => {
        let active = true
        const controller = new AbortController()
        setState({status: 'loading'})

        fetchHnThread(itemId, {signal: controller.signal})
            .then((thread) => {
                if (active) setState({status: 'ready', thread})
            })
            .catch(() => {
                if (active && !controller.signal.aborted) setState({status: 'error'})
            })

        return () => {
            active = false
            controller.abort()
        }
    }, [itemId])

    return state
}

function HnCommentItem({comment, depth}: { comment: HnComment; depth: number }) {
    const text = comment.text?.trim()
    const indent = Math.min(depth, MAX_DEPTH_INDENT) * INDENT_PX
    const createdAt = comment.createdAt > 0 ? new Date(comment.createdAt) : null

    return (
        <article className="hn-comment" style={{marginLeft: `${indent}px`}}>
            <div className="hn-comment-meta">
                {comment.author ? (
                    <a
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
            </div>
            {text ? (
                <div className="hn-comment-body">
                    <PostBody content={text} contentType="html"/>
                </div>
            ) : (
                <p className="hn-comment-deleted">[deleted]</p>
            )}
        </article>
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
    const entries = useMemo(() => flattenHnComments(thread.comments), [thread.comments])
    const shown = entries.slice(0, visible)
    const remaining = entries.length - shown.length

    return (
        <section className="hn-discussion" aria-label="Hacker News discussion">
            <div className="hn-discussion-meta">
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
                <div className="hn-comments">
                    {shown.map(({comment, depth}) => (
                        <HnCommentItem key={comment.id} comment={comment} depth={depth}/>
                    ))}
                </div>
            ) : (
                <p className="hn-discussion-status">No comments yet.</p>
            )}

            {remaining > 0 ? (
                <Button
                    variant="outline"
                    size="sm"
                    className="hn-more"
                    onClick={() => setVisible((value) => value + HN_VISIBLE_COMMENTS)}
                >
                    Show {remaining} more {remaining === 1 ? 'comment' : 'comments'}
                </Button>
            ) : null}
        </section>
    )
}

export function HnDiscussion({itemId}: { itemId: number }) {
    const state = useHnThread(itemId)

    if (state.status === 'ready') {
        return <HnThreadView thread={state.thread}/>
    }

    return (
        <section className="hn-discussion" aria-label="Hacker News discussion">
            {state.status === 'loading' ? (
                <p className="hn-discussion-status">Loading discussion…</p>
            ) : (
                <p className="hn-discussion-status">
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
