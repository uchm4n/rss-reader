import {useState} from 'react'
import {Settings} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Separator} from '@/components/ui/separator'
import type {Selection} from '@/shared/model/selection'
import {useFeedTree} from '../../hooks/use-feed-tree'
import {FolderTree} from './folder-tree'
import {SmartViews} from './smart-views'

interface SidebarProps {
    selection: Selection
    onSelect: (selection: Selection) => void
    onOpenSettings: () => void
}

export function Sidebar({selection, onSelect, onOpenSettings}: SidebarProps) {
    const tree = useFeedTree()
    const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

    const toggleFolder = (folderId: string) => {
        setCollapsed((previous) => {
            const next = new Set(previous)
            if (next.has(folderId)) next.delete(folderId)
            else next.add(folderId)
            return next
        })
    }

    return (
        <aside className="flex h-full w-[248px] shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
            <ScrollArea
                className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]]:overflow-x-hidden [&_[data-slot=scroll-area-viewport]>div]:!block [&_[data-slot=scroll-area-viewport]>div]:!w-full">
                <div className="w-full min-w-0 p-2">
                    <SmartViews selection={selection} onSelect={onSelect}/>
                    <Separator className="my-2"/>
                    <p className="px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        Feeds
                    </p>
                    <FolderTree
                        nodes={tree}
                        selection={selection}
                        collapsed={collapsed}
                        onToggle={toggleFolder}
                        onSelect={onSelect}
                    />
                </div>
            </ScrollArea>

            <div className="flex items-center justify-end border-t p-2">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onOpenSettings}
                    aria-label="Open settings"
                >
                    <Settings className="size-4"/>
                </Button>
            </div>
        </aside>
    )
}
