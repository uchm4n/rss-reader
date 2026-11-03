import {describe, expect, it} from 'vitest'
import {parseSelection} from '../../src/popup/hooks/use-selection'

describe('parseSelection', () => {
  it('parses stored smart views and entities', () => {
    expect(parseSelection('{"kind":"unread"}')).toEqual({kind: 'unread'})
    expect(parseSelection('{"kind":"feed","feedId":"10"}')).toEqual({
      kind: 'feed',
      feedId: '10'
    })
    expect(parseSelection('{"kind":"folder","folderId":"2"}')).toEqual({
      kind: 'folder',
      folderId: '2'
    })
    expect(parseSelection('{"kind":"search","query":"rust"}')).toEqual({
      kind: 'search',
      query: 'rust'
    })
  })

  it('falls back to all for invalid input', () => {
    expect(parseSelection(null)).toEqual({kind: 'all'})
    expect(parseSelection('{"kind":"nope"}')).toEqual({kind: 'all'})
    expect(parseSelection('{"kind":"feed","feedId":""}')).toEqual({kind: 'all'})
    expect(parseSelection('not json')).toEqual({kind: 'all'})
  })
})
