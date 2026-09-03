import type { SidePanelState } from '../state/panel-contracts'

export interface SiteSettingsPageProps {
  readonly state: SidePanelState
  readonly onToggle: () => void
}

export function SiteSettingsPage({ state, onToggle }: SiteSettingsPageProps) {
  const status = !state.siteStatusKnown
    ? 'Checking'
    : state.page
      ? state.siteEnabled ? 'Enabled' : 'Disabled'
      : 'Unavailable'

  return (
    <section className="panel-page" aria-labelledby="site-settings-title">
      <p className="extension-eyebrow">Current website</p>
      <h2 id="site-settings-title">Site settings</h2>
      <p className="panel-intro">Choose whether Capability Forge can learn and reuse workflows on this website.</p>
      <div className="site-settings-card">
        <span>Current site</span>
        <strong>{state.page?.origin ?? 'Open an HTTP or HTTPS website'}</strong>
        <small className={state.siteEnabled ? 'status-enabled' : ''}>{status}</small>
      </div>
      <button className="extension-primary site-access-button" type="button" disabled={!state.page || !state.siteStatusKnown || state.busy} onClick={onToggle}>
        {state.siteEnabled ? 'Disable on this site' : 'Enable on this site'}
      </button>
      <p className="site-access-note">Site access is optional, granted one website at a time, and can be removed here at any time.</p>
    </section>
  )
}
