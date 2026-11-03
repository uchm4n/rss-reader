import {describe, expect, it} from 'vitest'
import {formatRelativeTime, plainText} from '../../src/shared/model/post'

describe('plainText', () => {
  it('strips tags, decodes entities and collapses whitespace', () => {
    expect(plainText('<p>Hello &amp; welcome</p>\n<p>next</p>')).toBe(
      'Hello & welcome next'
    )
  })

  it('leaves an out-of-range numeric entity as text', () => {
    expect(plainText('bad &#x110000; entity')).toBe('bad &#x110000; entity')
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2024-01-02T00:00:00Z').getTime()

  it('formats short relative times', () => {
    expect(formatRelativeTime(new Date('2024-01-01T23:59:30Z'), now)).toBe('now')
    expect(formatRelativeTime(new Date('2024-01-01T21:00:00Z'), now)).toBe('3h ago')
    expect(formatRelativeTime(new Date('2023-12-30T00:00:00Z'), now)).toBe('3d ago')
  })

  it('formats older dates as a month and day', () => {
    expect(formatRelativeTime(new Date('2023-12-01T00:00:00Z'), now)).toBe('Dec 1')
  })
})
