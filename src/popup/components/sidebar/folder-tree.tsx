import {ChevronDown, ChevronRight, Folder} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'
import type {Selection} from '@/shared/model/selection'
import type {FeedTreeNode} from '@/shared/model/feed-tree'
import {FeedRow} from './feed-row'
import {UnreadCount} from './unread-count'

interface FolderTreeProps {
    nodes: FeedTreeNode[]
    selection: Selection
    collapsed: Set<string>
    depth?: number
    onToggle: (folderId: string) => void
    onSelect: (selection: Selection) => void
}

export function FolderTree({
                               nodes,
                               selection,
                               collapsed,
                               depth = 0,
                               onToggle,
                               onSelect
                           }: FolderTreeProps) {
    return (
        <div>
            {nodes.map((node) => {
                if (node.type === 'feed') {
                    return (
                        <div key={`feed:${node.feed.id}`} style={{paddingLeft: depth * 12}}>
                            <FeedRow
                                feed={node.feed}
                                selected={selection.kind === 'feed' && selection.feedId === node.feed.id}
                                onSelect={() => onSelect({kind: 'feed', feedId: node.feed.id})}
                            />
                        </div>
                    )
                }

                const isCollapsed = collapsed.has(node.id)
                const selected = selection.kind === 'folder' && selection.folderId === node.id

                return (
                    <div key={`folder:${node.id}`}>
                        <div style={{paddingLeft: depth * 12}}>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    onToggle(node.id)
                                    onSelect({kind: 'folder', folderId: node.id})
                                }}
                                aria-current={selected ? 'page' : undefined}
                                className={cn(
                                    'h-8 w-full justify-start gap-1.5 rounded-md pl-1! pr-2! text-left font-normal',
                                    selected && 'bg-accent text-accent-foreground font-medium'
                                )}
                            >
                                <UnreadCount count={node.unreadCount}/>
                                {isCollapsed ? (
                                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground"/>
                                ) : (
                                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground"/>
                                )}
                                <Folder className="size-4 shrink-0 text-muted-foreground"/>
                                <span className="min-w-0 flex-1 truncate">{node.name}</span>
                            </Button>
                        </div>

                        {!isCollapsed ? (
                            <FolderTree
                                nodes={node.items}
                                selection={selection}
                                collapsed={collapsed}
                                depth={depth + 1}
                                onToggle={onToggle}
                                onSelect={onSelect}
                            />
                        ) : null}
                    </div>
                )
            })}
        </div>
    )
}
