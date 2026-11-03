import {describe, expect, it} from 'vitest'
import {selectionKey, selectionTitle} from '../src/shared/model/selection'

const feed = (id: string, title: string) => ({id, title})
const folder = (id: string, name: string) => ({id, name})

describe('selection', () => {
  it('builds stable keys', () => {
    expect(selectionKey({kind: 'all'})).toBe('all')
    expect(selectionKey({kind: 'feed', feedId: '1'})).toBe('feed:1')
    expect(selectionKey({kind: 'search', query: 'rust'})).toBe('search:rust')
  })

  it('titles smart views and search', () => {
    expect(selectionTitle({kind: 'all'}, [], [])).toBe('All posts')
    expect(selectionTitle({kind: 'unread'}, [], [])).toBe('Unread')
    expect(selectionTitle({kind: 'starred'}, [], [])).toBe('Starred')
    expect(selectionTitle({kind: 'search', query: 'rust'}, [], [])).toBe('Results for “rust”')
  })

  it('titles feeds and folders', () => {
    expect(selectionTitle({kind: 'feed', feedId: '1'}, [], [feed('1', 'Laracasts')])).toBe(
      'Laracasts'
    )
    expect(selectionTitle({kind: 'folder', folderId: '2'}, [folder('2', 'Tech')], [])).toBe(
      'Tech'
    )
  })
})
