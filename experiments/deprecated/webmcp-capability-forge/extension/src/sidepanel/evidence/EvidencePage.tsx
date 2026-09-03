import {
  JsonTypes,
  VerificationStatus,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import type { SidePanelState } from '../state/panel-contracts'

const verificationLabels: Readonly<Record<VerificationStatus, string>> = {
  [VerificationStatus.Proposed]: 'Proposed for review',
  [VerificationStatus.PreflightPassed]: 'Preflight passed',
  [VerificationStatus.ReplayVerified]: 'Replay verified',
  [VerificationStatus.ReviewedNotReplayVerified]: 'Reviewed, not replay verified',
  [VerificationStatus.Failed]: 'Verification failed',
  [VerificationStatus.Stale]: 'Stale',
}

class EvidenceValues {
  static list(value: JsonValue, field: string): readonly JsonValue[] {
    if (!JsonTypes.isObject(value)) return []
    const candidate = value[field]
    return Array.isArray(candidate) ? candidate : []
  }

  static text(value: JsonValue, field: string, fallback: string): string {
    return JsonTypes.isObject(value) && typeof value[field] === 'string'
      ? value[field] as string
      : fallback
  }

  static number(value: JsonValue, field: string): number | null {
    return JsonTypes.isObject(value) && typeof value[field] === 'number'
      ? value[field] as number
      : null
  }
}

export function EvidencePage({ state }: { readonly state: SidePanelState }) {
  const proposals = EvidenceValues.list(state.evidence, 'proposals')
  const confirmations = EvidenceValues.list(state.evidence, 'confirmations')
  const recentOutcome = JsonTypes.isObject(state.evidence) ? state.evidence.recentOutcome : null
  return <section className="panel-page"><p className="extension-eyebrow">Local session evidence</p><h2>Trace and verification</h2><p className="panel-intro">Evidence stays on this device and remains labelled by source and verification strength.</p><h3>Chronological trace</h3>{state.session?.trace.length ? <ol>{state.session.trace.map((event) => <li key={event.id}><strong>{event.source} · {event.action}</strong><small>{event.path} · {new Date(event.timestamp).toISOString()}</small></li>)}</ol> : <p>No trace events yet.</p>}<h3>Proposal decisions</h3>{proposals.length ? <ul>{proposals.map((proposal, index) => <li key={EvidenceValues.text(proposal, 'requestId', String(index))}>{EvidenceValues.text(proposal, 'status', 'invalid')} · {EvidenceValues.text(proposal, 'requestId', 'request')}</li>)}</ul> : <p>No proposal decisions yet.</p>}<h3>Action confirmations</h3>{confirmations.length ? <ul>{confirmations.map((confirmation, index) => <li key={EvidenceValues.text(confirmation, 'requestId', String(index))}>{EvidenceValues.text(confirmation, 'status', 'invalid')} · {EvidenceValues.text(confirmation, 'action', 'action')} · {EvidenceValues.text(confirmation, 'target', 'target')}</li>)}</ul> : <p>No action confirmations yet.</p>}<h3>Tool revisions and verification</h3>{state.tools.length ? <ul>{state.tools.map((tool, index) => { const definition = JsonTypes.isObject(tool) && JsonTypes.isObject(tool.definition) ? tool.definition : null; const verification = definition && JsonTypes.isObject(definition.verification) ? definition.verification : null; const reduction = definition && JsonTypes.isObject(definition.traceReduction) ? definition.traceReduction : null; const status = verification && typeof verification.status === 'string' && Object.values(VerificationStatus).includes(verification.status as VerificationStatus) ? verification.status as VerificationStatus : VerificationStatus.Proposed; const attempts = verification && Array.isArray(verification.attempts) ? verification.attempts.length : 0; const rawEvents = EvidenceValues.number(reduction, 'rawEvents'); const compiledEvents = EvidenceValues.number(reduction, 'compiledEvents'); return <li key={definition && typeof definition.name === 'string' ? `${definition.name}-${String(definition.revision)}` : String(index)}><strong>{definition && typeof definition.title === 'string' ? definition.title : 'Capability'}</strong><small>{verificationLabels[status]} · {attempts} attempt(s)</small>{rawEvents !== null && compiledEvents !== null ? <small>{rawEvents} raw events → {compiledEvents} compiled steps</small> : null}{JsonTypes.isObject(tool) && JsonTypes.isObject(tool.failure) ? <small>Failure: {String(tool.failure.code)} · {String(tool.failure.message)}</small> : null}</li> })}</ul> : <p>No saved tool evidence yet.</p>}<h3>Most recent execution</h3>{JsonTypes.isObject(recentOutcome) ? <code>{JSON.stringify(recentOutcome, null, 2)}</code> : <p>No execution outcome yet.</p>}<p>Repair lineage is shown by revisions sharing the same capability name; failed replacements never replace the active revision.</p></section>
}
