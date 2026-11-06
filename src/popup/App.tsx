import {useCallback, useEffect, useRef, useState} from 'react'
import {toast} from 'sonner'
import {Toaster} from '@/components/ui/sonner'
import {TooltipProvider} from '@/components/ui/tooltip'
import type {DiscoveryResult} from '@/background/discovery'
import {type Selection, selectionTitle} from '@/shared/model/selection'
import {AppShell} from './components/app-shell'
import {PostList} from './components/posts/post-list'
import {PostReader} from './components/posts/post-reader'
import {Sidebar} from './components/sidebar/sidebar'
import {TopBar} from './components/top-bar'
import {useFeeds} from './hooks/use-feeds'
import {useFolders} from './hooks/use-folders'
import {useRestoredUiState} from './hooks/use-restored-ui-state'
import {useSettings} from './hooks/use-settings'
import {useSyncActionBadge} from './hooks/use-action-badge'
import {useTheme} from './hooks/use-theme'
import {sendCommand} from './lib/commands'
import {firstAddableFeedUrl} from './lib/discovery'
import {openExternal} from './platform'
import type {SettingsSection} from './settings/settings-nav'
import {SettingsView} from './settings/settings-view'

const SEARCH_DEBOUNCE_MS = 250

export default function App() {
    const feeds = useFeeds()
    const folders = useFolders()
    const settings = useSettings()
    const {
        selection,
        select,
        collapsedFolderIds,
        toggleFolder,
        openPostId,
        setOpenPostId,
        hydrated,
        restored
    } = useRestoredUiState({
        ready: settings !== undefined,
        enabled: settings?.persistUiState ?? false
    })
    const [searchValue, setSearchValue] = useState(
        selection.kind === 'search' ? selection.query : ''
    )
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [settingsSection, setSettingsSection] = useState<SettingsSection>('general')
    const [settingsInitialUrl, setSettingsInitialUrl] = useState('')
    const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const previousSelection = useRef<Selection>({kind: 'all'})
    const selectionRef = useRef<Selection>(selection)
    const appliedStartView = useRef(false)
    const appliedRestoredSearch = useRef(false)

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
        selectionRef.current = selection
    }, [selection])

    useEffect(() => {
        if (!hydrated || !restored || appliedRestoredSearch.current) return
        appliedRestoredSearch.current = true
        if (selection.kind === 'search') setSearchValue(selection.query)
    }, [hydrated, restored, selection])

    useEffect(() => {
        if (!settings || !hydrated || appliedStartView.current) return
        appliedStartView.current = true
        if (!restored) select({kind: settings.startView})
    }, [settings, hydrated, restored, select])

    const handleSelect = (next: Selection) => {
        setSearchValue('')
        select(next)
    }

    const commitSearch = useCallback((raw: string) => {
        const query = raw.trim()
        const current = selectionRef.current

        if (!query) {
            if (current.kind === 'search') {
                select(previousSelection.current)
            }
            return
        }

        if (current.kind !== 'search') {
            previousSelection.current = current
        }
        if (current.kind === 'search' && current.query === query) {
            return
        }

        select({kind: 'search', query})
    }, [select])

    useEffect(() => {
        const timer = window.setTimeout(
            () => commitSearch(searchValue),
            SEARCH_DEBOUNCE_MS
        )
        return () => window.clearTimeout(timer)
    }, [searchValue, commitSearch])

    const handleSearchSubmit = () => {
        commitSearch(searchValue)
    }

    const handleClearSearch = () => {
        setSearchValue('')
        select(previousSelection.current)
    }

    const openSettings = (section: SettingsSection = 'general', initialUrl = '') => {
        setSettingsSection(section)
        setSettingsInitialUrl(initialUrl)
        setSettingsOpen(true)
    }

    const handleAddFeed = async () => {
        let result = discovery
        if (!result) {
            try {
                result = await sendCommand<DiscoveryResult>({type: 'discovery:active'})
            } catch {
                result = null
            }
        }
        openSettings('feeds', firstAddableFeedUrl(result))
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
                    initialUrl={settingsInitialUrl}
                    onFeedAdded={() => setSettingsInitialUrl('')}
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
                        onAddFeed={() => void handleAddFeed()}
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
                        collapsed={collapsedFolderIds}
                        onToggleFolder={toggleFolder}
                    />
                }
            >
                <div className={openPostId ? 'hidden' : 'h-full'}>
                    <PostList selection={selection} onOpenPost={setOpenPostId}/>
                </div>
                {openPostId ? (
                    <div className="h-full min-w-0">
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
