import {existsSync, readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8')) as {
  background: {service_worker: string}
  action: {default_popup: string; default_icon: Record<string, string>}
  icons: Record<string, string>
  permissions?: string[]
  content_scripts?: unknown
}

describe('build assets', () => {
  it('keeps the local runtime entry points in source', () => {
    expect(existsSync('src/background/index.ts')).toBe(true)
    expect(existsSync('src/popup/index.html')).toBe(true)
    expect(manifest.background.service_worker).toBe('background/index.ts')
    expect(manifest.action.default_popup).toBe('popup/index.html')
  })

  it('resolves every manifest icon', () => {
    for (const path of [
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon)
    ]) {
      expect(existsSync(`public/${path}`), path).toBe(true)
    }
  })

  it('does not require a locale catalog', () => {
    expect(existsSync('_locales')).toBe(false)
  })

  it('has no content scripts', () => {
    expect(manifest.content_scripts).toBeUndefined()
  })

  it('grants scripting for on-demand feed detection', () => {
    expect(manifest.permissions).toContain('scripting')
  })
})
