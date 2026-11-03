import {afterEach, describe, expect, it} from 'vitest'
import {db} from '../../src/db/db'
import {formatBytes, loadStoreSummary, usagePercent} from '../../src/popup/lib/storage'
import {feedFixture, postFixture} from '../helpers/db'

afterEach(async () => {
  await db.delete()
  await db.open()
})

describe('loadStoreSummary', () => {
  it('counts each Dexie store and labels it', async () => {
    await db.feeds.bulkAdd([
      feedFixture({id: 'feed-1', url: 'https://example.com/one.xml'}),
      feedFixture({id: 'feed-2', url: 'https://example.com/two.xml'})
    ])
    await db.folders.add({
      id: 'folder-1',
      name: 'Tech',
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1
    })
    await db.posts.bulkAdd([
      postFixture({id: 'post-1', feedId: 'feed-1'}),
      postFixture({id: 'post-2', feedId: 'feed-1', guid: 'post-2'}),
      postFixture({id: 'post-3', feedId: 'feed-2', guid: 'post-3'})
    ])
    await db.settings.put({key: 'theme', value: 'dark'})
    await db.settings.put({key: 'refreshInterval', value: 300})

    const summary = await loadStoreSummary()

    expect(summary.map(({name, label, count}) => ({name, label, count}))).toEqual([
      {name: 'feeds', label: 'Feeds', count: 2},
      {name: 'folders', label: 'Folders', count: 1},
      {name: 'posts', label: 'Posts', count: 3},
      {name: 'settings', label: 'Settings', count: 2}
    ])
    expect(summary.every((store) => store.description.length > 0)).toBe(true)
  })
})

describe('formatBytes', () => {
  it('formats byte counts compactly', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1.5 * 1024 ** 2)).toBe('1.5 MB')
  })
})

describe('usagePercent', () => {
  it('clamps the usage ratio to 0–100', () => {
    expect(usagePercent(0, 100)).toBe(0)
    expect(usagePercent(50, 100)).toBe(50)
    expect(usagePercent(200, 100)).toBe(100)
    expect(usagePercent(10, 0)).toBe(0)
  })
})
