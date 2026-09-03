import {
  JsonTypes,
  SchemaCatalog,
  type CapabilityDefinition,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import {
  CapabilityHealth,
  CapabilityRevisionStatus,
} from '../../storage/capability-repository'
import { CapabilityDefinitionView } from '../components/CapabilityDefinitionView'
import type { SidePanelState } from '../state/panel-contracts'

interface ToolView {
  readonly key: string
  readonly title: string
  readonly status: CapabilityRevisionStatus
  readonly health: CapabilityHealth
  readonly definition: CapabilityDefinition
  readonly raw: JsonValue
}

export interface ToolsPageProps {
  readonly state: SidePanelState
  readonly onToggle: (tool: JsonValue) => void
  readonly onDelete: (tool: JsonValue) => void
  readonly onExport: (tool: JsonValue) => void
  readonly onImport: () => void
}

const statusLabels: Readonly<Record<CapabilityRevisionStatus, string>> = {
  [CapabilityRevisionStatus.Proposed]: 'Proposed',
  [CapabilityRevisionStatus.Active]: 'Active revision',
  [CapabilityRevisionStatus.Failed]: 'Failed verification',
  [CapabilityRevisionStatus.Superseded]: 'Superseded',
  [CapabilityRevisionStatus.Guarded]: 'Guarded',
  [CapabilityRevisionStatus.Disabled]: 'Disabled',
}

const healthLabels: Readonly<Record<CapabilityHealth, string>> = {
  [CapabilityHealth.Healthy]: 'Healthy',
  [CapabilityHealth.Stale]: 'Needs repair',
  [CapabilityHealth.Failed]: 'Failed',
  [CapabilityHealth.Unknown]: 'Not checked',
}

class ToolViews {
  static parse(value: JsonValue): ToolView | null {
    if (
      !JsonTypes.isObject(value) ||
      typeof value.status !== 'string' ||
      !Object.values(CapabilityRevisionStatus).includes(value.status as CapabilityRevisionStatus) ||
      value.definition === undefined
    ) return null
    const parsed = SchemaCatalog.parseCapability(value.definition)
    if (!parsed.valid) return null
    const health = typeof value.health === 'string' &&
      Object.values(CapabilityHealth).includes(value.health as CapabilityHealth)
      ? value.health as CapabilityHealth
      : CapabilityHealth.Unknown
    return {
      key: `${parsed.value.scope.origin}:${parsed.value.name}:${parsed.value.revision}`,
      title: parsed.value.title,
      status: value.status as CapabilityRevisionStatus,
      health,
      definition: parsed.value,
      raw: value,
    }
  }
}

export function ToolsPage({ state, onToggle, onDelete, onExport, onImport }: ToolsPageProps) {
  const tools = state.tools.flatMap((value) => {
    const parsed = ToolViews.parse(value)
    return parsed ? [parsed] : []
  })

  return (
    <section className="panel-page">
      <p className="extension-eyebrow">Current origin</p>
      <h2>Saved tools</h2>
      <p className="panel-intro">Inspect and manage the tool revisions saved for this website.</p>
      <button className="extension-secondary import-tool" type="button" onClick={onImport}>Import reviewed tool pack</button>

      {tools.length === 0 ? (
        <div className="empty-panel">
          <strong>No learned tools</strong>
          <span>Complete review and verification to register the first tool.</span>
        </div>
      ) : (
        <div className="tool-list" role="list">
          {tools.map((tool) => {
            const active = tool.status === CapabilityRevisionStatus.Active
            return (
              <details className="tool-item" key={tool.key} role="listitem">
                <summary>
                  <span className={active ? 'tool-availability active' : 'tool-availability inactive'}>{active ? 'Active' : 'Inactive'}</span>
                  <span className="tool-summary-name"><strong>{tool.title}</strong><small>{tool.definition.name}</small></span>
                  <span className="tool-summary-revision">Rev. {tool.definition.revision}</span>
                  <span className="tool-summary-chevron" aria-hidden="true" />
                </summary>
                <div className="tool-expanded">
                  <div className="tool-actions">
                    {tool.status === CapabilityRevisionStatus.Active || tool.status === CapabilityRevisionStatus.Disabled ? (
                      <button className="extension-secondary" type="button" onClick={() => onToggle(tool.raw)}>{active ? 'Disable' : 'Enable'}</button>
                    ) : null}
                    <button className="extension-secondary" type="button" onClick={() => onExport(tool.raw)}>Copy export</button>
                    <button className="extension-secondary danger" type="button" onClick={() => onDelete(tool.raw)}>Remove tool…</button>
                  </div>
                  <div className="tool-lifecycle">
                    <div><span>Lifecycle</span><strong>{statusLabels[tool.status]}</strong></div>
                    <div><span>Health</span><strong>{healthLabels[tool.health]}</strong></div>
                  </div>
                  <CapabilityDefinitionView definition={tool.definition} compact />
                </div>
              </details>
            )
          })}
        </div>
      )}
    </section>
  )
}
