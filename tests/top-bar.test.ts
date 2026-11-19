import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, it} from 'vitest'
import {TooltipProvider} from '../src/components/ui/tooltip'
import {TopBar} from '../src/popup/components/top-bar'

function render(canAddFeed: boolean): string {
  return renderToStaticMarkup(
    React.createElement(
      TooltipProvider,
      null,
      React.createElement(TopBar, {
        title: 'All posts',
        searchValue: '',
        onSearchChange: () => {},
        onSearchSubmit: () => {},
        onClearSearch: () => {},
        onAddFeed: () => {},
        canAddFeed,
        isCheckingFeed: false,
        onRefresh: () => {},
        onOpenSettings: () => {}
      })
    )
  )
}

describe('TopBar', () => {
  it('keeps the add button enabled when no feed is detected', () => {
    const html = render(false)
    const addButton = html.match(/<button[^>]*aria-label="Add feed"[^>]*>/)?.[0] ?? ''

    expect(addButton).toContain('aria-label="Add feed"')
    expect(addButton).not.toContain('disabled=""')
  })

  it('highlights the add button when a feed is available', () => {
    const html = render(true)
    const addButton = html.match(/<button[^>]*aria-label="Add feed"[^>]*>/)?.[0] ?? ''

    expect(addButton).toContain('data-feed-available="true"')
    expect(addButton).toContain('bg-add/15')
    expect(addButton).toContain('ring-add/20')
    expect(html).toContain('data-slot="add-feed-indicator"')
  })

  it('does not highlight the add button when no feed is available', () => {
    const html = render(false)
    const addButton = html.match(/<button[^>]*aria-label="Add feed"[^>]*>/)?.[0] ?? ''

    expect(addButton).toContain('data-feed-available="false"')
    expect(addButton).not.toContain('bg-add/15')
    expect(addButton).not.toContain('ring-add/20')
    expect(html).not.toContain('data-slot="add-feed-indicator"')
  })
})
