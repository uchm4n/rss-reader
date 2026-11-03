// @vitest-environment jsdom
import {describe, expect, it} from 'vitest'
import {sanitizePostHtml} from '../src/popup/lib/sanitize'

describe('sanitizePostHtml', () => {
  it('removes scripts and event handlers', () => {
    const html = sanitizePostHtml(
      '<p>Hi</p><script>alert(1)</script><img src="x" onerror="alert(1)">'
    )
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
  })

  it('forces external links to open safely', () => {
    const html = sanitizePostHtml('<a href="https://example.com">x</a>')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer noopener"')
  })
})
