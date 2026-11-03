import DOMPurify from 'dompurify'

let hookInstalled = false

export function sanitizePostHtml(html: string): string {
    if (!hookInstalled) {
        DOMPurify.addHook('afterSanitizeAttributes', (node) => {
            if (node.tagName === 'A') {
                node.setAttribute('target', '_blank')
                node.setAttribute('rel', 'noreferrer noopener')
            }
        })
        hookInstalled = true
    }

    return DOMPurify.sanitize(html, {
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        FORBID_ATTR: ['style']
    })
}
