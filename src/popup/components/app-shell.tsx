import type {ReactNode} from 'react'

interface AppShellProps {
    topBar: ReactNode
    sidebar: ReactNode
    children: ReactNode
}

export function AppShell({topBar, sidebar, children}: AppShellProps) {
    return (
        <div className="flex h-150 w-200 flex-col overflow-hidden bg-background text-foreground">
            {topBar}
            <div className="flex min-h-0 flex-1">
                {sidebar}
                <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
            </div>
        </div>
    )
}
