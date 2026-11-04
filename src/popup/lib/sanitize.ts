import DOMPurify from 'dompurify'
import {normalizeEmbedUrl} from './embed'

const EMBED_ALLOW = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen'
const EMBED_SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox'

let hookInstalled = false

export function sanitizePostHtml(html: string): string {
    if (!hookInstalled) {
        DOMPurify.addHook('afterSanitizeAttributes', (node) => {
            if (node.tagName === 'A') {
                node.setAttribute('target', '_blank')
                node.setAttribute('rel', 'noreferrer noopener')
            }

            if (node.tagName === 'IFRAME') {
                const embed = normalizeEmbedUrl(node.getAttribute('src'))
                if (!embed) {
                    node.remove()
                    return
                }

                const width = Number(node.getAttribute('width'))
                const height = Number(node.getAttribute('height'))
                const sourceRatio =
                    Number.isFinite(width) &&
                    width > 0 &&
                    Number.isFinite(height) &&
                    height > 0
                        ? width / height
                        : null
                const ratio = embed.forceAspectRatio
                    ? embed.aspectRatio
                    : sourceRatio ?? embed.aspectRatio
                const ratioValue = ratio.toFixed(4)

                node.setAttribute('src', embed.url)
                node.setAttribute('loading', 'lazy')
                node.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
                node.setAttribute('allowfullscreen', '')
                node.setAttribute('allow', EMBED_ALLOW)
                node.setAttribute('sandbox', EMBED_SANDBOX)
                if (!node.getAttribute('title')) {
                    node.setAttribute('title', `${embed.provider} video`)
                }
                node.removeAttribute('width')
                node.removeAttribute('height')
                node.setAttribute(
                    'style',
                    `aspect-ratio: ${ratioValue}; max-width: min(100%, calc(60vh * ${ratioValue}));`
                )
            }
        })
        hookInstalled = true
    }

    return DOMPurify.sanitize(html, {
        ADD_TAGS: ['iframe'],
        FORBID_TAGS: [
            'script',
            'style',
            'link',
            'meta',
            'base',
            'object',
            'embed',
            'form',
            'input',
            'button'
        ],
        FORBID_ATTR: ['style', 'srcdoc']
    })
}
