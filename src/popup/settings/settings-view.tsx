import {useState} from 'react'
import {ArrowLeft} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {ScrollArea} from '@/components/ui/scroll-area'
import {FeedsSettings} from './feeds-settings'
import {FoldersSettings} from './folders-settings'
import {GeneralSettings} from './general-settings'
import {OpmlSettings} from './opml-settings'
import {SettingsNav, type SettingsSection} from './settings-nav'
import {StorageSettings} from './storage-settings'

export function SettingsView({
    onBack,
    initialSection = 'general'
}: {
    onBack: () => void
    initialSection?: SettingsSection
}) {
    const [section, setSection] = useState<SettingsSection>(initialSection)

    return (
        <div className="flex h-150 w-200 flex-col overflow-hidden bg-background text-foreground">
            <header className="flex h-13 shrink-0 items-center gap-2 border-b px-3">
                <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to reader">
                    <ArrowLeft className="size-4"/>
                </Button>
                <span className="text-sm font-semibold">Settings</span>
            </header>

            <div className="flex min-h-0 flex-1">
                <SettingsNav section={section} onSelect={setSection}/>
                <ScrollArea className="min-h-0 min-w-0 flex-1">
                    <div className="p-4">
                        {section === 'general' ? <GeneralSettings/> : null}
                        {section === 'feeds' ? <FeedsSettings/> : null}
                        {section === 'folders' ? <FoldersSettings/> : null}
                        {section === 'opml' ? <OpmlSettings/> : null}
                        {section === 'storage' ? <StorageSettings/> : null}
                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}
