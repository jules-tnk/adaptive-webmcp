import { SchemaCatalog } from 'webmcp-capability-forge-core'

import { JsonCodec } from '../../storage/json-codec'

import {
  PanelSection,
  SidePanelActionType,
  type SidePanelAction,
  type SidePanelListener,
  type SidePanelState,
  type SidePanelUnsubscribe,
} from './panel-contracts'

export class SidePanelStore {
  private state: SidePanelState = {
    section: PanelSection.Session,
    page: null,
    siteEnabled: false,
    siteStatusKnown: false,
    goal: '',
    session: null,
    tools: [],
    proposals: [],
    confirmations: [],
    evidence: {},
    busy: false,
    error: null,
  }
  private readonly listeners = new Set<SidePanelListener>()

  getState(): SidePanelState {
    return this.state
  }

  dispatch(action: SidePanelAction): void {
    if (action.type === SidePanelActionType.SelectSection && typeof action.value === 'string') {
      this.state = { ...this.state, section: action.value as PanelSection }
    } else if (action.type === SidePanelActionType.SetGoal && typeof action.value === 'string') {
      this.state = { ...this.state, goal: action.value }
    } else if (action.type === SidePanelActionType.SetBusy && typeof action.value === 'boolean') {
      this.state = { ...this.state, busy: action.value }
    } else if (action.type === SidePanelActionType.SetError) {
      this.state = { ...this.state, error: typeof action.value === 'string' ? action.value : null }
    } else if (action.type === SidePanelActionType.SetSiteEnabled && typeof action.value === 'boolean') {
      this.state = { ...this.state, siteEnabled: action.value }
    } else if (action.type === SidePanelActionType.SetSiteStatusKnown && typeof action.value === 'boolean') {
      this.state = { ...this.state, siteStatusKnown: action.value }
    } else if (action.type === SidePanelActionType.SetPage) {
      this.state = { ...this.state, page: action.value as SidePanelState['page'] }
    } else if (action.type === SidePanelActionType.SetSession) {
      if (action.value === null) this.state = { ...this.state, session: null }
      else {
        const parsed = SchemaCatalog.parseSession(JsonCodec.value(action.value))
        if (parsed.valid) this.state = { ...this.state, session: parsed.value }
      }
    } else if (action.type === SidePanelActionType.SetTools && Array.isArray(action.value)) {
      this.state = { ...this.state, tools: action.value }
    } else if (action.type === SidePanelActionType.SetProposals && Array.isArray(action.value)) {
      this.state = { ...this.state, proposals: action.value }
    } else if (action.type === SidePanelActionType.SetConfirmations && Array.isArray(action.value)) {
      this.state = { ...this.state, confirmations: action.value }
    } else if (action.type === SidePanelActionType.SetEvidence) {
      this.state = { ...this.state, evidence: JsonCodec.value(action.value) }
    }
    this.listeners.forEach((listener) => listener())
  }

  subscribe(listener: SidePanelListener): SidePanelUnsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
