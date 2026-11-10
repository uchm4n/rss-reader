// @vitest-environment jsdom
import React from 'react'
import {createRoot} from 'react-dom/client'
import {renderToStaticMarkup} from 'react-dom/server'
import {act} from 'react-dom/test-utils'
import {describe, expect, it} from 'vitest'
import {
  appendMatchWords,
  MatchWordsInput
} from '../../src/popup/settings/match-words-input'
import {MAX_MATCH_WORDS} from '../../src/shared/model/match-words'

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', {bubbles: true}))
}

function pressEnter(input: HTMLInputElement) {
  input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))
}

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

  it('shows the current count against the limit', () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchWordsInput, {
        value: ['WordPress', 'AI'],
        onChange: () => {}
      })
    )

    expect(html).toContain(`2 / ${MAX_MATCH_WORDS}`)
  })

  it('disables the input at the limit', () => {
    const value = Array.from({length: MAX_MATCH_WORDS}, (_, index) => `word${index}`)
    const html = renderToStaticMarkup(
      React.createElement(MatchWordsInput, {value, onChange: () => {}})
    )

    expect(html).toContain(`${MAX_MATCH_WORDS} / ${MAX_MATCH_WORDS}`)
    expect(html).toContain('disabled=""')
  })
})

describe('appendMatchWords', () => {
  it('adds new words', () => {
    expect(appendMatchWords(['React'], 'vue')).toEqual({
      words: ['React', 'vue'],
      rejection: null
    })
  })

  it('rejects a normalized duplicate and keeps the current list', () => {
    expect(appendMatchWords(['React'], 'react')).toEqual({
      words: ['React'],
      rejection: 'duplicate'
    })
  })

  it('rejects additions at the limit', () => {
    const value = Array.from({length: MAX_MATCH_WORDS}, (_, index) => `word${index}`)

    expect(appendMatchWords(value, 'extra')).toEqual({
      words: value,
      rejection: 'limit'
    })
  })

  it('rejects an entry with no usable tokens', () => {
    expect(appendMatchWords([], '!!!')).toEqual({
      words: [],
      rejection: 'invalid'
    })
  })
})

describe('MatchWordsInput interaction', () => {
  it('reports duplicates and adds a new word', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    function Harness() {
      const [words, setWords] = React.useState(['React'])
      return React.createElement(MatchWordsInput, {
        value: words,
        onChange: setWords
      })
    }

    await act(async () => {
      root.render(React.createElement(Harness))
    })

    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Match words"]'
    )
    if (!input) throw new Error('input missing')

    await act(async () => {
      setInput(input, 'react')
    })
    await act(async () => {
      pressEnter(input)
    })

    expect(container.textContent).toContain('Already added')
    expect(container.textContent).toContain(`1 / ${MAX_MATCH_WORDS}`)
    expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(1)

    await act(async () => {
      setInput(input, 'Vue')
    })
    await act(async () => {
      pressEnter(input)
    })

    expect(container.textContent).not.toContain('Already added')
    expect(container.textContent).toContain(`2 / ${MAX_MATCH_WORDS}`)
    expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(2)

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})
