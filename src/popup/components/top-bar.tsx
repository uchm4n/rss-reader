import {Plus, RefreshCw, Search, Settings, X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Separator} from '@/components/ui/separator'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'

interface TopBarProps {
    title: string
    searchValue: string
    onSearchChange: (value: string) => void
    onSearchSubmit: () => void
    onClearSearch: () => void
    onAddFeed: () => void
    canAddFeed: boolean
    isCheckingFeed: boolean
    onRefresh: () => void
    onOpenSettings: () => void
    isRefreshing?: boolean
}

export function TopBar({
                           title,
                           searchValue,
                           onSearchChange,
                           onSearchSubmit,
                           onClearSearch,
                           onAddFeed,
                           canAddFeed,
                           isCheckingFeed,
                           onRefresh,
                           onOpenSettings,
                           isRefreshing
                       }: TopBarProps) {
    return (
        <header className="flex h-13 shrink-0 items-center gap-2 border-b px-3">
            <span className="text-sm font-semibold">RSS Reader</span>
            <Separator orientation="vertical" className="mx-1 h-5"/>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{title}</span>

            <div className="relative w-57.5 shrink-0">
                <Search
                    className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"/>
                <Input
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') onSearchSubmit()
                    }}
                    placeholder="Search all feeds"
                    aria-label="Search all feeds"
                    className="h-8 pr-7 pl-7 text-xs"
                />
                {searchValue ? (
                    <button
                        type="button"
                        onClick={onClearSearch}
                        aria-label="Clear search"
                        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-brand/10 hover:text-brand"
                    >
                        <X className="size-3.5"/>
                    </button>
                ) : null}
            </div>

            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onAddFeed}
                            aria-label="Add feed"
                            className="hover:bg-add/10 hover:text-add"
                        >
                            <Plus className="size-4"/>
                        </Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    {isCheckingFeed
                        ? 'Checking this page for feeds… add one manually'
                        : canAddFeed
                          ? 'Add feed from this page'
                          : 'Add a feed'}
                </TooltipContent>
            </Tooltip>

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onRefresh}
                        aria-label="Refresh feeds"
                        className="hover:bg-refresh/10 hover:text-refresh"
                    >
                        <RefreshCw className={isRefreshing ? 'size-4 animate-spin' : 'size-4'}/>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
            </Tooltip>

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onOpenSettings}
                        aria-label="Open settings"
                        className="hover:bg-settings/10 hover:text-settings"
                    >
                        <Settings className="size-4"/>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
            </Tooltip>
        </header>
    )
}
