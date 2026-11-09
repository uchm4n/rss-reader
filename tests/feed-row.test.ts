import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, it} from 'vitest'
import {TooltipProvider} from '../src/components/ui/tooltip'
import {FeedRow} from '../src/popup/components/sidebar/feed-row'
import {feedFixture} from './helpers/db'

function render(feed = feedFixture()): string {
  return renderToStaticMarkup(
    React.createElement(
      TooltipProvider,
      null,
      React.createElement(FeedRow, {
        feed,
        selected: false,
        onSelect: () => {}
      })
    )
  )
}

describe('FeedRow watch words', () => {
  it('shows an amber indicator and accessible match text', () => {
    const html = render(feedFixture({matchedWords: ['WordPress', 'AI']}))

    expect(html).toContain('Matches: WordPress, AI')
    expect(html).toContain('lucide-tag')
    expect(html).toContain('bg-star/20')
    expect(html).toContain('>2<')
  })

  it('renders no indicator when nothing matches', () => {
    const html = render(feedFixture({matchedWords: []}))

    expect(html).not.toContain('Matches:')
    expect(html).not.toContain('lucide-tag')
  })
})
