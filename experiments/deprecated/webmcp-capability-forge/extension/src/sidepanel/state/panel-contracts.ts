import type { ActivePage } from '../../ui/extension-client'
import type { JsonValue, LearningSession } from 'webmcp-capability-forge-core'

export enum PanelSection {
  Site = 'site',
  Session = 'session',
  Review = 'review',
  Tools = 'tools',
  Evidence = 'evidence',
}

export enum SidePanelActionType {
  SelectSection = 'select_section',
  SetPage = 'set_page',
  SetSiteEnabled = 'set_site_enabled',
  SetSiteStatusKnown = 'set_site_status_known',
  SetGoal = 'set_goal',
  SetSession = 'set_session',
  SetTools = 'set_tools',
  SetProposals = 'set_proposals',
  SetConfirmations = 'set_confirmations',
  SetEvidence = 'set_evidence',
  SetBusy = 'set_busy',
  SetError = 'set_error',
}

export interface SidePanelState {
  readonly section: PanelSection
  readonly page: ActivePage | null
  readonly siteEnabled: boolean
  readonly siteStatusKnown: boolean
  readonly goal: string
  readonly session: LearningSession | null
  readonly tools: readonly JsonValue[]
  readonly proposals: readonly JsonValue[]
  readonly confirmations: readonly JsonValue[]
  readonly evidence: JsonValue
  readonly busy: boolean
  readonly error: string | null
}

export interface SidePanelAction {
  readonly type: SidePanelActionType
  readonly value: JsonValue | ActivePage | PanelSection | null
}

export type SidePanelListener = () => void
export type SidePanelUnsubscribe = () => void
