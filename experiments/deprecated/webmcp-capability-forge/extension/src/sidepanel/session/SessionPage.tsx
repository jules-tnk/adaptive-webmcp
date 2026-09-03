import { SessionStatus } from 'webmcp-capability-forge-core'

import type { SidePanelState } from '../state/panel-contracts'

export interface SessionPageProps {
  readonly state: SidePanelState
  readonly onGoalChange: (goal: string) => void
  readonly onStartManual: () => void
  readonly onStop: () => void
}

export function SessionPage({ state, onGoalChange, onStartManual, onStop }: SessionPageProps) {
  return (
    <section className="panel-page" aria-labelledby="session-title">
      <p className="extension-eyebrow">Active website</p>
      <h2 id="session-title">Build a capability</h2>
      <p className="panel-intro">{state.siteEnabled ? 'Teach a workflow here. Agents start exploration themselves when they cannot reuse a healthy tool.' : 'Enable this website in Site before starting a learning session.'}</p>
      {state.error ? <p role="alert" className="panel-error">{state.error}</p> : null}
      <label className="extension-field">Workflow goal<textarea value={state.goal} onChange={(event) => onGoalChange(event.target.value)} placeholder="Example: Find a notebook and shortlist it" /></label>
      <div className="mode-actions">
        <button type="button" disabled={!state.siteEnabled || !state.goal.trim() || state.busy} onClick={onStartManual}>Teach a workflow</button>
      </div>
      <div className="session-status" aria-live="polite">
        <span>{state.session?.status ?? SessionStatus.Idle}</span>
        <strong>{state.session ? `${state.session.trace.length} trace events` : 'No active session'}</strong>
        <small>{state.page?.origin ?? 'Open a supported website.'}</small>
      </div>
      {state.session ? <button className="panel-stop" type="button" disabled={state.busy} onClick={onStop}>{state.busy ? 'Saving trace…' : 'Stop and save trace'}</button> : null}
    </section>
  )
}
