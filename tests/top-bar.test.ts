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
})
