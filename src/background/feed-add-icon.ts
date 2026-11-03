import {
    GRAY_ACTION_ICONS,
    UNREAD_ACTION_ICONS,
    type ActionIconPaths
} from '../shared/model/action-icon'

type AddIconKind = 'add-gray' | 'add-amber'

const cache = new Map<AddIconKind, Record<string, ImageData>>()

function baseIcons(kind: AddIconKind): ActionIconPaths {
    return kind === 'add-amber' ? UNREAD_ACTION_ICONS : GRAY_ACTION_ICONS
}

async function buildIcon(path: string, size: number): Promise<ImageData> {
    const response = await fetch(chrome.runtime.getURL(path.replace(/^\//, '')))
    const bitmap = await createImageBitmap(await response.blob())
    const canvas = new OffscreenCanvas(size, size)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create an icon canvas')

    context.drawImage(bitmap, 0, 0, size, size)

    const radius = size * 0.28
    const centerX = size - radius - 1
    const centerY = size - radius - 1
    const bar = radius * 0.9

    context.beginPath()
    context.arc(centerX, centerY, radius, 0, Math.PI * 2)
    context.fillStyle = '#ffffff'
    context.fill()

    context.beginPath()
    context.strokeStyle = '#111827'
    context.lineWidth = Math.max(1, size * 0.08)
    context.lineCap = 'round'
    context.moveTo(centerX - bar / 2, centerY)
    context.lineTo(centerX + bar / 2, centerY)
    context.moveTo(centerX, centerY - bar / 2)
    context.lineTo(centerX, centerY + bar / 2)
    context.stroke()

    return context.getImageData(0, 0, size, size)
}

export async function feedAddIcon(
    kind: AddIconKind
): Promise<Record<string, ImageData>> {
    const cached = cache.get(kind)
    if (cached) return cached

    const icons = baseIcons(kind)
    const entries = await Promise.all(
        (['16', '32', '48', '128'] as const).map(async (size) => [
            size,
            await buildIcon(icons[size], Number(size))
        ] as const)
    )
    const result = Object.fromEntries(entries)
    cache.set(kind, result)
    return result
}
