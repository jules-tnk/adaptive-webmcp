import {
  FailureCode,
  ValidationIssueCode,
  type BridgeEnvelope,
  type ValidationResult,
} from 'webmcp-capability-forge-core'

export class BridgeReplayGuard {
  private readonly seen = new Set<string>()

  accept(envelope: BridgeEnvelope): ValidationResult<BridgeEnvelope> {
    if (this.seen.has(envelope.requestId)) {
      return {
        valid: false,
        failure: FailureCode.BridgeReplay,
        issues: [
          {
            path: 'requestId',
            code: ValidationIssueCode.BridgeReplay,
            message: 'Bridge request identifier has already been used.',
          },
        ],
      }
    }
    this.seen.add(envelope.requestId)
    return { valid: true, value: structuredClone(envelope) }
  }
}
