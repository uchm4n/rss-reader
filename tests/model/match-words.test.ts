import {describe, expect, it} from 'vitest'
import {
  findMatchedWords,
  findMatchRanges,
  MAX_MATCH_WORDS,
  safeFindMatchedWords,
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

  it('does not turn short words into unrelated stems', () => {
    expect(findMatchedWords(['news'], [postFixture({title: 'A new study'})])).toEqual([])
    expect(findMatchedWords(['does'], [postFixture({title: 'What do you think'})])).toEqual([])
    expect(findMatchedWords(['being'], [postFixture({title: 'I want to be'})])).toEqual([])
  })

  it('matches common inflected forms', () => {
    const cases: Array<[string, string]> = [
      ['move', 'moved'],
      ['use', 'used'],
      ['save', 'saved'],
      ['like', 'liked'],
      ['name', 'named'],
      ['make', 'making'],
      ['thing', 'things'],
      ['bring', 'brings'],
      ['string', 'strings']
    ]

    for (const [word, title] of cases) {
      expect(findMatchedWords([word], [postFixture({title})])).toEqual([word])
    }
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

  it('returns no matches instead of failing when a post is malformed', () => {
    const bad = Object.defineProperty({}, 'title', {
      get() {
        throw new Error('bad post')
      }
    })

    expect(
      safeFindMatchedWords(['WordPress'], [bad as never])
    ).toEqual([])
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
    expect(
      sanitizeMatchWords(Array.from({length: 50}, (_, index) => `word${index}`))
    ).toHaveLength(50)
    expect(
      sanitizeMatchWords(
        Array.from({length: MAX_MATCH_WORDS + 5}, (_, index) => `word${index}`)
      )
    ).toHaveLength(MAX_MATCH_WORDS)
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

  it('does not highlight a short word inside an unrelated stem', () => {
    expect(findMatchRanges('A new study', ['news'])).toEqual([])
  })

  it('highlights inflected forms', () => {
    expect(findMatchRanges('moved house', ['move'])).toEqual([{start: 0, end: 5}])
  })
})
