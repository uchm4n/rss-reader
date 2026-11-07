// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {
    closePinnedPostWindow,
    openPinnedPost,
    pinnedPostIdFromUrl,
    pinnedPostWindowKey,
    pinnedWindowBounds
} from '../../src/popup/lib/pinned-post'

const session = new Map<string, unknown>()
const sessionGet = vi.fn(async (key: string) => ({[key]: session.get(key)}))
const sessionSet = vi.fn(async (items: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(items)) session.set(key, value)
})
const sessionRemove = vi.fn(async (key: string) => {
    session.delete(key)
})
const windowsUpdate = vi.fn()
const windowsCreate = vi.fn()
const windowsGetCurrent = vi.fn()
const windowsRemove = vi.fn()

beforeEach(() => {
    session.clear()
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/action/index.html')
    vi.stubGlobal('chrome', {
        storage: {
            session: {
                get: sessionGet,
                set: sessionSet,
                remove: sessionRemove
            }
        },
        windows: {
            update: windowsUpdate,
            create: windowsCreate,
            getCurrent: windowsGetCurrent,
            remove: windowsRemove
        }
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('pinnedPostIdFromUrl', () => {
    it('reads a pinned post id from the query string', () => {
        expect(pinnedPostIdFromUrl('?pinnedPost=post-1')).toBe('post-1')
        expect(pinnedPostIdFromUrl('?foo=bar&pinnedPost=post-2')).toBe('post-2')
    })

    it('ignores missing or empty values', () => {
        expect(pinnedPostIdFromUrl('')).toBeNull()
        expect(pinnedPostIdFromUrl('?pinnedPost=')).toBeNull()
        expect(pinnedPostIdFromUrl('?pinnedPost=%20')).toBeNull()
    })
})

describe('pinnedWindowBounds', () => {
    it('aligns the right edge and top with the popup', () => {
        expect(
            pinnedWindowBounds(
                {x: 600, y: 20, width: 800},
                {left: 0, top: 0, width: 1440, height: 900}
            )
        ).toEqual({left: 800, top: 28, width: 600, height: 700})
    })

    it('clamps the window to the screen edges', () => {
        expect(
            pinnedWindowBounds(
                {x: 1200, y: 800, width: 800},
                {left: 0, top: 0, width: 1440, height: 900}
            )
        ).toEqual({left: 840, top: 200, width: 600, height: 700})
    })

    it('uses the current display offset', () => {
        expect(
            pinnedWindowBounds(
                {x: 2000, y: 10, width: 800},
                {left: 1920, top: 0, width: 1920, height: 1080}
            )
        ).toEqual({left: 2200, top: 18, width: 600, height: 700})
    })

    it('stays on a screen smaller than the window', () => {
        expect(
            pinnedWindowBounds(
                {x: 0, y: 0, width: 500},
                {left: 0, top: 0, width: 500, height: 600}
            )
        ).toEqual({left: 0, top: 0, width: 600, height: 700})
    })
})

describe('pinned post windows', () => {
    it('focuses an existing window for the post', async () => {
        const key = pinnedPostWindowKey('post-1')
        session.set(key, 42)
        windowsUpdate.mockResolvedValue({id: 42})

        await openPinnedPost('post-1')

        expect(windowsUpdate).toHaveBeenCalledWith(42, {focused: true})
        expect(windowsCreate).not.toHaveBeenCalled()
    })

    it('replaces a stale window id', async () => {
        const key = pinnedPostWindowKey('post-1')
        session.set(key, 42)
        windowsUpdate
            .mockRejectedValueOnce(new Error('No window with id: 42'))
            .mockResolvedValue({})
        windowsCreate.mockResolvedValue({id: 7, state: 'normal'})

        await openPinnedPost('post-1')

        expect(sessionRemove).toHaveBeenCalledWith(key)
        expect(windowsCreate).toHaveBeenCalledWith({
            url: expect.stringContaining('pinnedPost=post-1'),
            type: 'popup',
            left: expect.any(Number),
            top: expect.any(Number),
            width: 600,
            height: 700,
            state: 'normal',
            focused: true
        })
        expect(session.get(key)).toBe(7)
    })

    it('creates a window when the post has not been pinned', async () => {
        windowsCreate.mockResolvedValue({id: 9, state: 'normal'})

        await openPinnedPost('post-2')

        expect(windowsCreate).toHaveBeenCalledTimes(1)
        expect(session.get(pinnedPostWindowKey('post-2'))).toBe(9)
    })

    it('corrects a window created fullscreen', async () => {
        windowsCreate.mockResolvedValue({
            id: 11,
            state: 'fullscreen',
            left: 0,
            top: 0,
            width: 1440,
            height: 900
        })
        windowsUpdate.mockResolvedValue({})

        await openPinnedPost('post-3')

        expect(windowsUpdate).toHaveBeenCalledWith(
            11,
            expect.objectContaining({
                state: 'normal',
                width: 600,
                height: 700
            })
        )
    })

    it('keeps the window if the OS refuses the bounds correction', async () => {
        windowsCreate.mockResolvedValue({id: 12, state: 'fullscreen'})
        windowsUpdate.mockRejectedValue(new Error('cannot resize'))

        await openPinnedPost('post-4')

        expect(session.get(pinnedPostWindowKey('post-4'))).toBe(12)
    })

    it('closes the current pinned window and forgets its id', async () => {
        const key = pinnedPostWindowKey('post-1')
        session.set(key, 42)
        windowsGetCurrent.mockResolvedValue({id: 42})
        windowsRemove.mockResolvedValue(undefined)

        await closePinnedPostWindow('post-1')

        expect(session.has(key)).toBe(false)
        expect(windowsRemove).toHaveBeenCalledWith(42)
    })
})
