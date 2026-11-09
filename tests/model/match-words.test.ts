import {describe, expect, it} from 'vitest'
import {
  findMatchedWords,
  findMatchRanges,
  sanitizeMatchWords
} from '../../src/shared/model/match-words'
import {postFixture} from '../helpers/db'

describe('findMatchedWords', () => {
  it('matches case-insensitively in post titles', () => {
    expect(
      findMatchedWords(['WordPress'], [postFixture({title: 'A wordpress update'})])
    ).toEqual(['WordPress'])
  })

  it('matches phrases, accents and punctuation variants', () => {
    expect(
      findMatchedWords(['new york'], [postFixture({title: 'New York today'})])
    ).toEqual(['new york'])
    expect(
      findMatchedWords(['cafe'], [postFixture({title: 'Café news'})])
    ).toEqual(['cafe'])
    expect(
      findMatchedWords(['wordpress.com'], [postFixture({title: 'Visit WordPress.com'})])
    ).toEqual(['wordpress.com'])
  })

  it('matches word forms', () => {
    expect(
      findMatchedWords(['politics'], [postFixture({title: 'Political news'})])
    ).toEqual(['politics'])
    expect(findMatchedWords(['run'], [postFixture({title: 'Running fast'})])).toEqual([
      'run'
    ])
    expect(
      findMatchedWords(['category'], [postFixture({title: 'Categories'})])
    ).toEqual(['category'])
  })

  it('tolerates transpositions in longer words', () => {
    expect(
      findMatchedWords(['wordpress'], [postFixture({title: 'Wrodpress news'})])
    ).toEqual(['wordpress'])
  })

  it('does not fuzzy match short words inside other words', () => {
    expect(findMatchedWords(['AI'], [postFixture({title: 'He said hello'})])).toEqual([])
  })

  it('searches plain text extracted from html bodies', () => {
    expect(
      findMatchedWords(
        ['WordPress'],
        [
          postFixture({
            title: 'News',
            excerpt: '',
            contentHtml: '<p>Hello <strong>WordPress</strong></p>',
            contentType: 'html'
          })
        ]
      )
    ).toEqual(['WordPress'])
  })

  it('returns every match in input order', () => {
    expect(
      findMatchedWords(
        ['WordPress', 'AI', 'missing'],
        [postFixture({title: 'WordPress and AI'})]
      )
    ).toEqual(['WordPress', 'AI'])
  })
})

describe('sanitizeMatchWords', () => {
  it('trims, collapses whitespace, dedupes case-insensitively and drops empties', () => {
    expect(sanitizeMatchWords(['  WordPress  ', 'wordpress', '', '  AI  '])).toEqual([
      'WordPress',
      'AI'
    ])
  })

  it('caps the list and each word', () => {
    expect(sanitizeMatchWords(Array.from({length: 25}, (_, index) => `word${index}`))).toHaveLength(20)
    expect(sanitizeMatchWords(['x'.repeat(50)])[0]).toHaveLength(40)
  })
})

describe('findMatchRanges', () => {
  it('returns ranges for exact and phrase matches', () => {
    expect(findMatchRanges('Hello WordPress world', ['wordpress'])).toEqual([
      {start: 6, end: 15}
    ])
    expect(findMatchRanges('New York today', ['new york'])).toEqual([
      {start: 0, end: 8}
    ])
  })

  it('merges overlapping ranges', () => {
    expect(findMatchRanges('wordpress', ['word', 'wordpress'])).toEqual([
      {start: 0, end: 9}
    ])
  })
})
