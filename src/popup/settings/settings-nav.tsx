import {Database, FileUp, Folder, Rss, Settings2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'

export type SettingsSection = 'general' | 'feeds' | 'folders' | 'opml' | 'storage'

const sections = [
    {id: 'general' as const, label: 'General', icon: Settings2},
    {id: 'feeds' as const, label: 'Feeds', icon: Rss},
    {id: 'folders' as const, label: 'Folders', icon: Folder},
    {id: 'opml' as const, label: 'OPML', icon: FileUp},
    {id: 'storage' as const, label: 'Storage', icon: Database}
]

export function SettingsNav({
                                section,
                                onSelect
                            }: {
    section: SettingsSection
    onSelect: (section: SettingsSection) => void
}) {
    return (
        <nav className="flex w-40 shrink-0 flex-col gap-0.5 border-r p-2">
            {sections.map((item) => {
                const Icon = item.icon
                return (
                    <Button
                        key={item.id}
                        variant="ghost"
                        size="sm"
                        aria-current={section === item.id ? 'page' : undefined}
                        className={cn(
                            'group h-8 w-full justify-start gap-2 px-2 font-normal hover:bg-brand/5',
                            section === item.id && 'bg-accent text-accent-foreground font-medium'
                        )}
                        onClick={() => onSelect(item.id)}
                    >
                        <Icon className="size-4 shrink-0 group-hover:text-brand"/>
                        <span className="truncate">{item.label}</span>
                    </Button>
                )
            })}
        </nav>
    )
}
