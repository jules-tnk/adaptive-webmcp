import { describe, expect, it } from 'vitest'

import {
  FailureCode,
  SelectorKind,
  SelectorRanker,
  type SelectorCandidate,
} from '../index'

describe('SelectorRanker', () => {
  it('prefers accessible identity over structural position', () => {
    const candidates: readonly SelectorCandidate[] = [
      {
        kind: SelectorKind.Structural,
        selector: 'main > div:nth-child(2) > button',
        score: 100,
        uniqueAtRecording: true,
      },
      {
        kind: SelectorKind.AccessibleRole,
        selector: 'button[aria-label="Search"]',
        score: 0,
        uniqueAtRecording: true,
      },
    ]

    const ranked = SelectorRanker.rank(candidates)

    expect(ranked[0]?.kind).toBe(SelectorKind.AccessibleRole)
    expect(ranked[1]?.kind).toBe(SelectorKind.Structural)
  })

  it('deduplicates equivalent candidate selectors', () => {
    const candidates: readonly SelectorCandidate[] = [
      {
        kind: SelectorKind.StableName,
        selector: '[name="query"]',
        score: 0,
        uniqueAtRecording: true,
      },
      {
        kind: SelectorKind.StableName,
        selector: '[name="query"]',
        score: 0,
        uniqueAtRecording: true,
      },
    ]

    expect(SelectorRanker.rank(candidates)).toHaveLength(1)
  })

  it('rejects a best candidate that was ambiguous while recording', () => {
    const result = SelectorRanker.select([
      {
        kind: SelectorKind.AccessibleRole,
        selector: 'button',
        score: 0,
        uniqueAtRecording: false,
      },
    ])

    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.failure).toBe(FailureCode.TargetAmbiguous)
  })
})
