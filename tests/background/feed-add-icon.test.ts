import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {feedAddIcon} from '../../src/background/feed-add-icon'

const getImageData = vi.fn(() => ({width: 1, height: 1}))
const context = {
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    getImageData,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: ''
}

beforeEach(() => {
    vi.stubGlobal('chrome', {
        runtime: {getURL: (path: string) => `chrome-extension://id/${path}`}
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({blob: async () => new Blob()}))
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({}))
    vi.stubGlobal(
        'OffscreenCanvas',
        class {
            constructor(
                public width: number,
                public height: number
            ) {}

            getContext() {
                return context
            }
        }
    )
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('feedAddIcon', () => {
    it('builds and caches every icon size', async () => {
        const first = await feedAddIcon('add-gray')
        const second = await feedAddIcon('add-gray')

        expect(Object.keys(first)).toEqual(['16', '32', '48', '128'])
        expect(second).toBe(first)
        expect(globalThis.fetch).toHaveBeenCalledTimes(4)
        expect(getImageData).toHaveBeenCalledTimes(4)
    })
})
