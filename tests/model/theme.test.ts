import {describe, expect, it} from 'vitest'
import {resolveTheme} from '../../src/popup/hooks/use-theme'

describe('resolveTheme', () => {
  it('keeps an explicit theme', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows the system preference for system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})
