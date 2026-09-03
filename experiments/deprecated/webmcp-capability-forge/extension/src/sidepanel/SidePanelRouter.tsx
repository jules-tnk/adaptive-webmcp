import { EvidencePage } from './evidence/EvidencePage'
import { ReviewPage } from './review/ReviewPage'
import { SessionPage } from './session/SessionPage'
import { SiteSettingsPage } from './site/SiteSettingsPage'
import { PanelSection, type SidePanelState } from './state/panel-contracts'
import { ToolsPage } from './tools/ToolsPage'
import type { JsonValue } from 'webmcp-capability-forge-core'

export interface SidePanelRouterProps {
  readonly state: SidePanelState
  readonly onGoalChange: (goal: string) => void
  readonly onStartManual: () => void
  readonly onStop: () => void
  readonly onApprove: (requestId: string) => void
  readonly onReject: (requestId: string) => void
  readonly onResolveConfirmation: (requestId: string, approved: boolean) => void
  readonly onToggleTool: (tool: JsonValue) => void
  readonly onDeleteTool: (tool: JsonValue) => void
  readonly onExportTool: (tool: JsonValue) => void
  readonly onImportTool: () => void
  readonly onToggleSite: () => void
}

export function SidePanelRouter(props: SidePanelRouterProps) {
  if (props.state.section === PanelSection.Site) return <SiteSettingsPage state={props.state} onToggle={props.onToggleSite} />
  if (props.state.section === PanelSection.Review) return <ReviewPage state={props.state} onApprove={props.onApprove} onReject={props.onReject} onResolveConfirmation={props.onResolveConfirmation} />
  if (props.state.section === PanelSection.Tools) return <ToolsPage state={props.state} onToggle={props.onToggleTool} onDelete={props.onDeleteTool} onExport={props.onExportTool} onImport={props.onImportTool} />
  if (props.state.section === PanelSection.Evidence) return <EvidencePage state={props.state} />
  return <SessionPage state={props.state} onGoalChange={props.onGoalChange} onStartManual={props.onStartManual} onStop={props.onStop} />
}
