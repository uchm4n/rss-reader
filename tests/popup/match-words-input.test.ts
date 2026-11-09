import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, it} from 'vitest'
import {MatchWordsInput} from '../../src/popup/settings/match-words-input'

describe('MatchWordsInput', () => {
  it('renders each word as a chip with a remove control', () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchWordsInput, {
        value: ['WordPress', 'AI'],
        onChange: () => {}
      })
    )

    expect(html).toContain('WordPress')
    expect(html).toContain('AI')
    expect(html).toContain('aria-label="Remove match word WordPress"')
    expect(html).toContain('aria-label="Remove match word AI"')
    expect(html).toContain('aria-label="Match words"')
  })

  it('shows the placeholder only while the list is empty', () => {
    const empty = renderToStaticMarkup(
      React.createElement(MatchWordsInput, {value: [], onChange: () => {}})
    )
    const filled = renderToStaticMarkup(
      React.createElement(MatchWordsInput, {value: ['WordPress'], onChange: () => {}})
    )

    expect(empty).toContain('placeholder="Match words…"')
    expect(filled).not.toContain('placeholder="Match words…"')
  })
})
