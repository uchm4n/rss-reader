import type {ReactNode} from 'react'
import {Input} from '@/components/ui/input'
import {setSetting} from '@/db/settings'
import type {AppSettings} from '@/db/types'
import {clearUiState} from '@/db/ui-state'
import {trimAllFeeds} from '@/db/posts'
import {syncActionBadge} from '@/background/badge'
import {useSettings} from '../hooks/use-settings'
import {sendCommand} from '../lib/commands'

const REFRESH_OPTIONS = [
    {value: 30, label: '30 seconds'},
    {value: 60, label: '1 minute'},
    {value: 300, label: '5 minutes'},
    {value: 900, label: '15 minutes (Default)'},
    {value: 1_800, label: '30 minutes'},
    {value: 3_600, label: '1 hour'}
]

function Field({
                   label,
                   description,
                   children
               }: {
    label: string
    description?: string
    children: ReactNode
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
                <p className="text-xs font-medium">{label}</p>
                {description ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
                ) : null}
            </div>
            {children}
        </div>
    )
}

const selectClass =
    'h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground'

export function GeneralSettings() {
    const settings = useSettings()
    if (!settings) return null

    const update = async <K extends keyof AppSettings>(
        key: K,
        value: AppSettings[K]
    ) => {
        await setSetting(key, value)
        if (key === 'refreshInterval') {
            await sendCommand({type: 'worker:reschedule'})
        }
        if (key === 'persistUiState' && value === false) {
            await clearUiState()
        }
    }

    const commitRetention = async (raw: string) => {
        const parsed = Number(raw)
        if (!Number.isFinite(parsed)) return

        const retention = Math.max(1, Math.trunc(parsed))
        if (retention === settings.retentionPerFeed) return

        await setSetting('retentionPerFeed', retention)
        await trimAllFeeds(retention)
        await syncActionBadge()
    }

    return (
        <div className="space-y-6">
            <section className="space-y-3">
                <h2 className="text-sm font-semibold">Appearance</h2>
                <Field label="Theme" description="Use light, dark or follow the system.">
                    <select
                        aria-label="Theme"
                        className={selectClass}
                        value={settings.theme}
                        onChange={(event) =>
                            void update('theme', event.target.value as AppSettings['theme'])
                        }
                    >
                        <option value="system">System</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </Field>
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-semibold">Refresh</h2>
                <Field
                    label="Refresh interval"
                    description="The minimum is 30 seconds. Feeds can override this."
                >
                    <select
                        aria-label="Refresh interval"
                        className={selectClass}
                        value={settings.refreshInterval}
                        onChange={(event) =>
                            void update('refreshInterval', Number(event.target.value))
                        }
                    >
                        {REFRESH_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field
                    label="Default posts per feed"
                    description="Used by feeds without their own limit. Older posts are removed when a feed grows past its limit."
                >
                    <Input
                        key={settings.retentionPerFeed}
                        type="number"
                        min={1}
                        defaultValue={settings.retentionPerFeed}
                        aria-label="Default posts per feed"
                        className="h-8 w-20 text-xs"
                        onBlur={(event) => void commitRetention(event.target.value)}
                    />
                </Field>
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-semibold">Reading</h2>
                <Field
                    label="Notifications"
                    description="Show a notification when a refresh finds new posts."
                >
                    <input
                        type="checkbox"
                        aria-label="Notifications"
                        className="size-4 accent-primary"
                        checked={settings.notifications}
                        onChange={(event) => void update('notifications', event.target.checked)}
                    />
                </Field>
                <Field
                    label="Mark read on open"
                    description="Mark a post as read when you open it."
                >
                    <input
                        type="checkbox"
                        aria-label="Mark read on open"
                        className="size-4 accent-primary"
                        checked={settings.markReadOnOpen}
                        onChange={(event) => void update('markReadOnOpen', event.target.checked)}
                    />
                </Field>
                <Field
                    label="Start view"
                    description="Used when there is no saved app state to restore."
                >
                    <select
                        aria-label="Start view"
                        className={selectClass}
                        value={settings.startView}
                        onChange={(event) =>
                            void update('startView', event.target.value as AppSettings['startView'])
                        }
                    >
                        <option value="all">All posts</option>
                        <option value="unread">Unread</option>
                        <option value="starred">Starred</option>
                    </select>
                </Field>
                <Field
                    label="Remember app state"
                    description="Reopen on your last view, including collapsed folders and the open post."
                >
                    <input
                        type="checkbox"
                        aria-label="Remember app state"
                        className="size-4 accent-primary"
                        checked={settings.persistUiState}
                        onChange={(event) =>
                            void update('persistUiState', event.target.checked)
                        }
                    />
                </Field>
            </section>
        </div>
    )
}
