const PINNED_POST_PARAM = 'pinnedPost'
const PINNED_WINDOW_PREFIX = 'pinnedPost:'
const PINNED_WINDOW_WIDTH = 600
const PINNED_WINDOW_HEIGHT = 700
const PINNED_WINDOW_GAP = 8

export interface PinnedWindowBounds {
    left: number
    top: number
    width: number
    height: number
}

export function pinnedWindowBounds(
    popup: { x: number; y: number; width: number },
    screen: { left: number; top: number; width: number; height: number }
): PinnedWindowBounds {
    const maxLeft = screen.left + screen.width - PINNED_WINDOW_WIDTH
    const maxTop = screen.top + screen.height - PINNED_WINDOW_HEIGHT
    const desiredLeft = popup.x + popup.width - PINNED_WINDOW_WIDTH
    const desiredTop = popup.y + PINNED_WINDOW_GAP

    return {
        left: Math.round(
            Math.min(
                Math.max(desiredLeft, screen.left),
                Math.max(screen.left, maxLeft)
            )
        ),
        top: Math.round(
            Math.min(
                Math.max(desiredTop, screen.top),
                Math.max(screen.top, maxTop)
            )
        ),
        width: PINNED_WINDOW_WIDTH,
        height: PINNED_WINDOW_HEIGHT
    }
}

export function pinnedPostIdFromUrl(search: string): string | null {
    const value = new URLSearchParams(search).get(PINNED_POST_PARAM)?.trim()
    return value || null
}

export function pinnedPostWindowKey(postId: string): string {
    return `${PINNED_WINDOW_PREFIX}${postId}`
}

export async function openPinnedPost(postId: string): Promise<void> {
    const key = pinnedPostWindowKey(postId)
    const stored = await chrome.storage.session.get(key)
    const windowId = stored[key]

    if (typeof windowId === 'number') {
        try {
            await chrome.windows.update(windowId, {focused: true})
            return
        } catch {
            await chrome.storage.session.remove(key)
        }
    }

    const screen = window.screen as Screen & {
        availLeft?: number
        availTop?: number
    }
    const bounds = pinnedWindowBounds(
        {
            x: window.screenX,
            y: window.screenY,
            width: window.outerWidth || window.innerWidth
        },
        {
            left: screen.availLeft ?? 0,
            top: screen.availTop ?? 0,
            width: screen.availWidth || screen.width,
            height: screen.availHeight || screen.height
        }
    )

    const url = new URL(window.location.href)
    url.searchParams.set(PINNED_POST_PARAM, postId)
    const created = await chrome.windows.create({
        url: url.toString(),
        type: 'popup',
        ...bounds,
        state: 'normal',
        focused: true
    })

    if (created?.id !== undefined) {
        if (
            created.state !== 'normal' ||
            created.left !== bounds.left ||
            created.top !== bounds.top
        ) {
            try {
                await chrome.windows.update(created.id, {
                    state: 'normal',
                    ...bounds
                })
            } catch {
                // Keep the created window even if the OS refuses the bounds correction.
            }
        }

        await chrome.storage.session.set({[key]: created.id})
    }
}

export async function closePinnedPostWindow(postId: string): Promise<void> {
    await chrome.storage.session.remove(pinnedPostWindowKey(postId))

    const current = await chrome.windows.getCurrent()
    if (current.id !== undefined) {
        await chrome.windows.remove(current.id)
        return
    }

    window.close()
}
