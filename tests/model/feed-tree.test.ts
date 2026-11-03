import {describe, expect, it} from 'vitest'
import {feedFixture} from '../helpers/db'
import {buildFeedTree, type FeedTreeNode} from '../../src/shared/model/feed-tree'
import type {Folder} from '../../src/db/types'

function folder(id: string, name: string, sortOrder: number): Folder {
  return {id, name, sortOrder, createdAt: 1, updatedAt: 1}
}

function label(node: FeedTreeNode): string {
  return node.type === 'folder' ? `folder:${node.name}` : `feed:${node.feed.title}`
}

describe('buildFeedTree', () => {
  it('renders root feeds first and folders in sort order', () => {
    const feeds = [
      feedFixture({id: 'feed-1', title: 'Zeta'}),
      feedFixture({id: 'feed-2', title: 'Alpha', folderId: 'folder-2'}),
      feedFixture({id: 'feed-3', title: 'Beta', folderId: 'folder-1'})
    ]
    const folders = [
      folder('folder-2', 'Later', 2),
      folder('folder-1', 'Earlier', 1)
    ]

    expect(buildFeedTree(feeds, folders).map(label)).toEqual([
      'feed:Zeta',
      'folder:Earlier',
      'folder:Later'
    ])
  })

  it('sums unread counts per folder and does not duplicate feeds', () => {
    const feeds = [
      feedFixture({id: 'feed-1', title: 'One', folderId: 'folder-1', unreadCount: 2}),
      feedFixture({id: 'feed-2', title: 'Two', folderId: 'folder-1', unreadCount: 3})
    ]

    const tree = buildFeedTree(feeds, [folder('folder-1', 'Tech', 0)])

    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({
      type: 'folder',
      id: 'folder-1',
      name: 'Tech',
      unreadCount: 5
    })
    expect(tree[0].type === 'folder' ? tree[0].items : []).toHaveLength(2)
  })

  it('keeps feeds with a missing folder at the root', () => {
    const feeds = [
      feedFixture({id: 'feed-1', title: 'Orphan', folderId: 'missing', unreadCount: 4})
    ]

    const tree = buildFeedTree(feeds, [])

    expect(tree.map(label)).toEqual(['feed:Orphan'])
  })
})
