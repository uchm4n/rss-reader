import type {ReactNode} from 'react'

const MAX_DEPTH_INDENT = 8
const INDENT_PX = 12

export function CommentToggle({
    collapsed,
    onToggle
}: {
    collapsed: boolean
    onToggle: () => void
}) {
    return (
        <button
            type="button"
            className="discussion-comment-toggle"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand replies' : 'Collapse replies'}
        >
            {collapsed ? '[+]' : '[-]'}
        </button>
    )
}

export function DiscussionComment({
    depth,
    hasReplies,
    collapsed,
    onToggle,
    meta,
    children
}: {
    depth: number
    hasReplies: boolean
    collapsed: boolean
    onToggle: () => void
    meta: ReactNode
    children: ReactNode
}) {
    const className =
        depth === 0
            ? 'discussion-comment discussion-comment-root'
            : 'discussion-comment discussion-comment-reply'

    return (
        <article
            className={className}
            style={{marginLeft: `${Math.min(depth, MAX_DEPTH_INDENT) * INDENT_PX}px`}}
        >
            <div className="discussion-comment-meta">
                {hasReplies ? (
                    <CommentToggle collapsed={collapsed} onToggle={onToggle}/>
                ) : null}
                {meta}
            </div>
            <div className="discussion-comment-body">{children}</div>
        </article>
    )
}
