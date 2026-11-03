import {useEffect, useRef, useState} from 'react'
import {toast} from 'sonner'
import {Toaster} from '@/components/ui/sonner'
import {TooltipProvider} from '@/components/ui/tooltip'
import type {DiscoveryResult} from '@/background/discovery'
import {type Selection, selectionTitle} from '@/shared/model/selection'
import {AddDetectedFeedView} from './components/add-detected-feed-view'
import {AppShell} from './components/app-shell'
import {PostList} from './components/posts/post-list'
import {PostReader} from './components/posts/post-reader'
import {Sidebar} from './components/sidebar/sidebar'
import {TopBar} from './components/top-bar'
import {useFeeds} from './hooks/use-feeds'
import {useFolders} from './hooks/use-folders'
import {useSelection} from './hooks/use-selection'
import {useSettings} from './hooks/use-settings'
import {useSyncActionBadge} from './hooks/use-action-badge'
import {useTheme} from './hooks/use-theme'
import {sendCommand} from './lib/commands'
import {openExternal} from './platform'
import type {SettingsSection} from './settings/settings-nav'
import {SettingsView} from './settings/settings-view'

export default function App() {
    const feeds = useFeeds()
    const folders = useFolders()
    const settings = useSettings()
    const {selection, setSelection} = useSelection()
    const [searchValue, setSearchValue] = useState(
        selection.kind === 'search' ? selection.query : ''
    )
    const [openPostId, setOpenPostId] = useState<string | null>(null)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [settingsSection, setSettingsSection] = useState<SettingsSection>('general')
    const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null)
    const [addFeedOpen, setAddFeedOpen] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const previousSelection = useRef<Selection>({kind: 'all'})
    const appliedStartView = useRef(false)

    useSyncActionBadge()
    useTheme()

    useEffect(() => {
        let cancelled = false

        void sendCommand<DiscoveryResult>({type: 'discovery:active'})
            .then((result) => {
                if (cancelled) return
                setDiscovery(result)
            })
            .catch(() => {
                if (cancelled) return
                setDiscovery({tabId: null, pageUrl: null, feeds: []})
            })

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        setOpenPostId(null)
    }, [selection])

    useEffect(() => {
        if (!settings || appliedStartView.current) return
        appliedStartView.current = true
        setSelection({kind: settings.startView})
    }, [settings, setSelection])

    const handleSelect = (next: Selection) => {
        setSearchValue('')
        setSelection(next)
    }

    const handleSearchSubmit = () => {
        const query = searchValue.trim()
        if (!query) {
            setSelection(previousSelection.current)
            return
        }
        if (selection.kind !== 'search') previousSelection.current = selection
        setSelection({kind: 'search', query})
    }

    const handleClearSearch = () => {
        setSearchValue('')
        setSelection(previousSelection.current)
    }

    const openSettings = (section: SettingsSection = 'general') => {
        setSettingsSection(section)
        setSettingsOpen(true)
    }

    const refresh = async () => {
        setIsRefreshing(true)
        try {
            await sendCommand({type: 'feed:refresh-all'})
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Refresh failed')
        } finally {
            setIsRefreshing(false)
        }
    }

    if (settingsOpen) {
        return (
            <TooltipProvider>
                <SettingsView
                    initialSection={settingsSection}
                    onBack={() => setSettingsOpen(false)}
                />
                <Toaster position="bottom-right"/>
            </TooltipProvider>
        )
    }

    const unsubscribedFeeds =
        discovery?.feeds.filter((feed) => !feed.subscribed) ?? []
    const canAddFeed =
        discovery !== null &&
        discovery.tabId !== null &&
        unsubscribedFeeds.length > 0

    if (
        addFeedOpen &&
        discovery !== null &&
        discovery.tabId !== null &&
        unsubscribedFeeds.length
    ) {
        return (
            <TooltipProvider>
                <AddDetectedFeedView
                    feeds={unsubscribedFeeds}
                    tabId={discovery.tabId}
                    onAdded={() => {
                        setAddFeedOpen(false)
                        openSettings('feeds')
                    }}
                    onCancel={() => setAddFeedOpen(false)}
                />
                <Toaster position="bottom-right"/>
            </TooltipProvider>
        )
    }

    return (
        <TooltipProvider>
            <AppShell
                topBar={
                    <TopBar
                        title={selectionTitle(selection, folders ?? [], feeds ?? [])}
                        searchValue={searchValue}
                        onSearchChange={setSearchValue}
                        onSearchSubmit={handleSearchSubmit}
                        onClearSearch={handleClearSearch}
                        onAddFeed={() => setAddFeedOpen(true)}
                        canAddFeed={canAddFeed}
                        isCheckingFeed={discovery === null}
                        onRefresh={() => void refresh()}
                        onOpenSettings={() => openSettings()}
                        isRefreshing={isRefreshing}
                    />
                }
                sidebar={
                    <Sidebar
                        selection={selection}
                        onSelect={handleSelect}
                        onOpenSettings={() => openSettings()}
                    />
                }
            >
                <div className={openPostId ? 'hidden' : 'h-full'}>
                    <PostList selection={selection} onOpenPost={setOpenPostId}/>
                </div>
                {openPostId ? (
                    <div className="h-full">
                        <PostReader
                            postId={openPostId}
                            onBack={() => setOpenPostId(null)}
                            onOpenOriginal={openExternal}
                        />
                    </div>
                ) : null}
            </AppShell>
            <Toaster position="bottom-right"/>
        </TooltipProvider>
    )
}
