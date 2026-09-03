import {
  FailureCode,
  ValidationIssueCode,
  type ValidationResult,
} from '../contracts/error-contracts'
import { SelectorKind, type SelectorCandidate } from './selector-contracts'

const kindWeights: Readonly<Record<SelectorKind, number>> = {
  [SelectorKind.AccessibleRole]: 95,
  [SelectorKind.AssociatedLabel]: 85,
  [SelectorKind.StableName]: 75,
  [SelectorKind.StableId]: 65,
  [SelectorKind.SemanticAttribute]: 55,
  [SelectorKind.Structural]: 15,
}

export class SelectorRanker {
  static rank(candidates: readonly SelectorCandidate[]): readonly SelectorCandidate[] {
    const unique = new Map<string, SelectorCandidate>()
    for (const candidate of candidates) {
      if (unique.has(candidate.selector)) continue
      const score = Math.min(
        100,
        kindWeights[candidate.kind] + (candidate.uniqueAtRecording ? 5 : 0),
      )
      unique.set(candidate.selector, { ...candidate, score })
    }
    return [...unique.values()].sort((left, right) => right.score - left.score)
  }

  static select(
    candidates: readonly SelectorCandidate[],
  ): ValidationResult<SelectorCandidate> {
    const ranked = SelectorRanker.rank(candidates)
    const best = ranked[0]
    if (!best) {
      return {
        valid: false,
        failure: FailureCode.TargetMissing,
        issues: [
          {
            path: 'target.candidates',
            code: ValidationIssueCode.TargetMissing,
            message: 'No selector candidate is available.',
          },
        ],
      }
    }
    if (!best.uniqueAtRecording) {
      return {
        valid: false,
        failure: FailureCode.TargetAmbiguous,
        issues: [
          {
            path: 'target.candidates',
            code: ValidationIssueCode.TargetAmbiguous,
            message: 'The highest-ranked selector was ambiguous while recording.',
          },
        ],
      }
    }
    return { valid: true, value: best }
  }
}
