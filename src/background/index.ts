import {db} from '../db/db'
import {getSettings} from '../db/settings'
import {refreshAction} from './badge'
import {clearDiscovery} from './discovery'
import {type Command, type CommandResult, handleCommand, runDueFeeds} from './messages'
import {ALARM_NAME, nextDueAt} from './scheduler'

async function scheduleAlarm(): Promise<void> {
    const [feeds, settings] = await Promise.all([db.feeds.toArray(), getSettings()])
    const now = Date.now()

    await chrome.alarms.clear(ALARM_NAME)
    if (!feeds.length) return

    const next = nextDueAt(feeds, now)
    const target = next !== null && next > now ? next : now + 1_000
    await chrome.alarms.create(ALARM_NAME, {
        when: Math.max(target, now + 1_000)
    })
}

async function initialize(): Promise<void> {
    await scheduleAlarm()
    await refreshAction()
}

chrome.runtime.onInstalled.addListener(() => {
    void initialize().catch((error) => console.error('RSS Reader initialize failed', error))
})

chrome.runtime.onStartup.addListener(() => {
    void initialize().catch((error) => console.error('RSS Reader initialize failed', error))
})

chrome.tabs.onActivated.addListener(({tabId}) => {
    void refreshAction(tabId).catch((error) =>
        console.error('RSS Reader tab icon update failed', error)
    )
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete' && !changeInfo.url) return

    void refreshAction(tabId, {forceDiscovery: true}).catch((error) =>
        console.error('RSS Reader tab icon update failed', error)
    )
})

chrome.tabs.onRemoved.addListener((tabId) => {
    clearDiscovery(tabId)
})

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAME) return

    void (async () => {
        try {
            await runDueFeeds(Date.now())
        } catch (error) {
            console.error('RSS Reader refresh failed', error)
        } finally {
            await scheduleAlarm().catch((error) =>
                console.error('RSS Reader alarm schedule failed', error)
            )
        }
    })()
})

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void (async () => {
        let result: CommandResult

        try {
            result = await handleCommand(message as Command)
            if (result.ok) {
                await scheduleAlarm().catch((error) =>
                    console.error('RSS Reader alarm schedule failed', error)
                )
            }
        } catch (error) {
            console.error('RSS Reader command failed', error)
            result = {ok: false, error: errorMessage(error)}
        }

        try {
            sendResponse(result)
        } catch (error) {
            console.error('RSS Reader response failed', error)
        }
    })()

    return true
})

console.info('RSS Reader background ready')
