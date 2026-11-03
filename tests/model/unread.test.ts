import {describe, expect, it} from 'vitest'
import {totalUnread} from '../../src/shared/model/unread'

describe('totalUnread', () => {
  it('sums every feed count', () => {
    expect(totalUnread([{unreadCount: 2}, {unreadCount: 3}, {unreadCount: 0}])).toBe(5)
  })

  it('is zero for no feeds', () => {
    expect(totalUnread([])).toBe(0)
  })
})
