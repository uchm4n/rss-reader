import {describe, expect, it} from 'vitest'
import {
  actionIconForCount,
  actionIconKind,
  GRAY_ACTION_ICONS,
  UNREAD_ACTION_ICONS
} from '../../src/shared/model/action-icon'

describe('actionIconForCount', () => {
  it('uses the gray icon when caught up', () => {
    expect(actionIconForCount(0)).toBe(GRAY_ACTION_ICONS)
  })

  it('uses the amber icon when unread posts exist', () => {
    expect(actionIconForCount(1)).toBe(UNREAD_ACTION_ICONS)
    expect(actionIconForCount(99)).toBe(UNREAD_ACTION_ICONS)
  })
})

describe('actionIconKind', () => {
  it('maps feed availability and unread state', () => {
    expect(actionIconKind(false, 0)).toBe('gray')
    expect(actionIconKind(false, 2)).toBe('unread')
    expect(actionIconKind(true, 0)).toBe('add-gray')
    expect(actionIconKind(true, 2)).toBe('add-amber')
  })
})
