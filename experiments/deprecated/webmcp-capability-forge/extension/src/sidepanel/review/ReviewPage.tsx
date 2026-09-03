import { JsonTypes, SchemaCatalog } from 'webmcp-capability-forge-core'

import { CapabilityDefinitionView } from '../components/CapabilityDefinitionView'
import type { SidePanelState } from '../state/panel-contracts'

export interface ReviewPageProps {
  readonly state: SidePanelState
  readonly onApprove: (requestId: string) => void
  readonly onReject: (requestId: string) => void
  readonly onResolveConfirmation: (requestId: string, approved: boolean) => void
}

export function ReviewPage({
  state,
  onApprove,
  onReject,
  onResolveConfirmation,
}: ReviewPageProps) {
  const proposal = state.proposals.find((value) => JsonTypes.isObject(value))
  const requestId = JsonTypes.isObject(proposal) && typeof proposal.requestId === 'string'
    ? proposal.requestId
    : null
  const parsedDefinition = JsonTypes.isObject(proposal) && proposal.definition !== undefined
    ? SchemaCatalog.parseCapability(proposal.definition)
    : null
  const definition = parsedDefinition?.valid ? parsedDefinition.value : null
  const confirmations = state.confirmations.filter(
    (value) => JsonTypes.isObject(value) && typeof value.requestId === 'string',
  )

  return (
    <section className="panel-page">
      <p className="extension-eyebrow">Human approval</p>
      <h2>Review capability</h2>
      <p className="panel-intro">Check what the tool can access and what it will do before activation.</p>
      {state.error ? <p role="alert" className="panel-error">{state.error}</p> : null}

      {confirmations.map((value) => JsonTypes.isObject(value) && typeof value.requestId === 'string' ? (
        <div className="proposal-panel" key={value.requestId}>
          <span>Action confirmation required</span>
          <strong>{String(value.action)} · {String(value.effect)}</strong>
          <small>{String(value.origin)}{String(value.path)}</small>
          <small>Target: {String(value.target)}</small>
          <button className="extension-primary" type="button" disabled={state.busy} onClick={() => onResolveConfirmation(value.requestId as string, true)}>Allow this action</button>
          <button className="extension-secondary" type="button" disabled={state.busy} onClick={() => onResolveConfirmation(value.requestId as string, false)}>Deny</button>
        </div>
      ) : null)}

      {requestId && definition ? (
        <article className="review-workspace">
          <header className="review-proposal-header">
            <span>Pending proposal</span>
            <h3>{definition.title}</h3>
            <p>{definition.description}</p>
            {state.session ? <small>Trace mode · {state.session.mode}</small> : null}
          </header>
          <CapabilityDefinitionView definition={definition} />
          <div className="review-actions">
            <button className="extension-primary" type="button" disabled={state.busy} onClick={() => onApprove(requestId)}>Approve and verify</button>
            <button className="extension-secondary danger" type="button" disabled={state.busy} onClick={() => onReject(requestId)}>Reject</button>
          </div>
        </article>
      ) : confirmations.length === 0 ? (
        <div className="empty-panel">
          <strong>No proposal awaiting review</strong>
          <span>{state.session ? 'Continue collecting evidence in Session.' : 'Start a learning session first.'}</span>
        </div>
      ) : null}
    </section>
  )
}
