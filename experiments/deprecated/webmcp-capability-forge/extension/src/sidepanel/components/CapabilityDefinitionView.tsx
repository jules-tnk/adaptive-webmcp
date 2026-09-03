import {
  CapabilityClassification,
  ExpectedEffectKind,
  ExtractSource,
  InteractionEffect,
  JsonSchemaPropertyType,
  ValueSource,
  VerificationStatus,
  WorkflowAction,
  type CapabilityDefinition,
  type ExpectedEffect,
  type TargetStrategy,
  type WorkflowStep,
} from 'webmcp-capability-forge-core'

export interface CapabilityDefinitionViewProps {
  readonly definition: CapabilityDefinition
  readonly compact?: boolean
}

const classificationLabels: Readonly<Record<CapabilityClassification, string>> = {
  [CapabilityClassification.Read]: 'Read only',
  [CapabilityClassification.LocalUi]: 'Local page changes',
  [CapabilityClassification.Navigation]: 'Navigation',
  [CapabilityClassification.ExternalWrite]: 'External change',
  [CapabilityClassification.BlockedSensitive]: 'Blocked sensitive action',
}

const verificationLabels: Readonly<Record<VerificationStatus, string>> = {
  [VerificationStatus.Proposed]: 'Awaiting verification',
  [VerificationStatus.PreflightPassed]: 'Preflight passed',
  [VerificationStatus.ReplayVerified]: 'Replay verified',
  [VerificationStatus.ReviewedNotReplayVerified]: 'Reviewed without replay',
  [VerificationStatus.Failed]: 'Verification failed',
  [VerificationStatus.Stale]: 'Needs repair',
}

const actionLabels: Readonly<Record<WorkflowAction, string>> = {
  [WorkflowAction.Fill]: 'Fill field',
  [WorkflowAction.Click]: 'Click',
  [WorkflowAction.Select]: 'Choose option',
  [WorkflowAction.Check]: 'Set checkbox',
  [WorkflowAction.Keypress]: 'Press key',
  [WorkflowAction.ScrollIntoView]: 'Bring into view',
  [WorkflowAction.WaitFor]: 'Wait for element',
  [WorkflowAction.WaitForUrl]: 'Wait for route',
  [WorkflowAction.Extract]: 'Read content',
}

const propertyTypeLabels: Readonly<Record<JsonSchemaPropertyType, string>> = {
  [JsonSchemaPropertyType.String]: 'Text',
  [JsonSchemaPropertyType.Number]: 'Number',
  [JsonSchemaPropertyType.Integer]: 'Whole number',
  [JsonSchemaPropertyType.Boolean]: 'Yes or no',
}

class DefinitionLabels {
  static target(target: TargetStrategy): string {
    return target.name ?? target.role ?? 'Page element'
  }

  static step(step: WorkflowStep): string {
    if (step.action === WorkflowAction.Fill || step.action === WorkflowAction.Select) {
      if (step.value.source === ValueSource.Input) return `Uses the “${step.value.name}” input.`
      if (step.value.source === ValueSource.Step) return `Uses output from “${step.value.step}”.`
      return 'Uses a fixed reviewed value.'
    }
    if (step.action === WorkflowAction.Check) return step.checked ? 'Checks this control.' : 'Clears this control.'
    if (step.action === WorkflowAction.Keypress) return `Presses ${DefinitionLabels.key(step)}.`
    if (step.action === WorkflowAction.WaitFor) return `Waits up to ${Math.round(step.timeoutMs / 1000)} seconds.`
    if (step.action === WorkflowAction.WaitForUrl) return `Continues when the route matches ${step.pathPattern}.`
    if (step.action === WorkflowAction.Extract) {
      const fields = step.fields.map((field) => field.source === ExtractSource.Attribute
        ? `${field.name} attribute`
        : field.name).join(', ')
      return `Saves ${fields} as “${step.saveAs}”.`
    }
    if (step.action === WorkflowAction.ScrollIntoView) return 'Moves the target into the visible page area.'
    if (step.action === WorkflowAction.Click && step.effect) return `Expected effect: ${DefinitionLabels.effect(step.effect)}.`
    return 'Performs the reviewed action on this target.'
  }

  static expected(effect: ExpectedEffect): string {
    if (effect.kind === ExpectedEffectKind.ElementVisible) return `${DefinitionLabels.target(effect.target)} is visible.`
    if (effect.kind === ExpectedEffectKind.ElementValue) return `${DefinitionLabels.target(effect.target)} has the expected value.`
    if (effect.kind === ExpectedEffectKind.UrlMatches) return `The route matches ${effect.pathPattern}.`
    return `${DefinitionLabels.target(effect.target)} contains ${effect.count} item${effect.count === 1 ? '' : 's'}.`
  }

  static effect(effect: InteractionEffect): string {
    return effect.replaceAll('_', ' ')
  }

  static key(step: Extract<WorkflowStep, { readonly action: WorkflowAction.Keypress }>): string {
    const modifiers = [
      step.ctrlKey ? 'Ctrl' : null,
      step.altKey ? 'Alt' : null,
      step.metaKey ? 'Meta' : null,
      step.shiftKey ? 'Shift' : null,
      step.key,
    ].filter((value): value is string => value !== null)
    return modifiers.join('+')
  }
}

export function CapabilityDefinitionView({ definition, compact = false }: CapabilityDefinitionViewProps) {
  const requiredInputs = new Set(definition.inputSchema.required)
  const inputEntries = Object.entries(definition.inputSchema.properties)
  const humanEvents = definition.provenanceSummary.humanEvents
  const agentEvents = definition.provenanceSummary.agentEvents
  const verifierEvents = definition.provenanceSummary.verifierEvents

  return (
    <div className={compact ? 'capability-definition compact' : 'capability-definition'}>
      <div className="definition-overview" aria-label="Capability summary">
        <div><span>Risk</span><strong>{classificationLabels[definition.classification]}</strong></div>
        <div><span>Revision</span><strong>{definition.revision}</strong></div>
        <div><span>Verification</span><strong>{verificationLabels[definition.verification.status]}</strong></div>
      </div>

      <section className="definition-section" aria-labelledby={`${definition.name}-scope`}>
        <header><span>01</span><h3 id={`${definition.name}-scope`}>Scope</h3></header>
        <p className="definition-origin">{definition.scope.origin}</p>
        <div className="definition-tags" aria-label="Allowed paths">
          {definition.scope.pathPatterns.map((path) => <span key={path}>{path}</span>)}
        </div>
      </section>

      <section className="definition-section" aria-labelledby={`${definition.name}-inputs`}>
        <header><span>02</span><h3 id={`${definition.name}-inputs`}>Inputs</h3></header>
        {inputEntries.length === 0
          ? <p className="definition-empty">This tool does not require input.</p>
          : <ul className="definition-inputs">{inputEntries.map(([name, property]) => (
              <li key={name}>
                <div><strong>{name}</strong><span>{requiredInputs.has(name) ? 'Required' : 'Optional'}</span></div>
                <small>{propertyTypeLabels[property.type]}{property.description ? ` · ${property.description}` : ''}</small>
              </li>
            ))}</ul>}
      </section>

      <section className="definition-section" aria-labelledby={`${definition.name}-steps`}>
        <header><span>03</span><h3 id={`${definition.name}-steps`}>Workflow steps</h3></header>
        <ol className="definition-steps">{definition.steps.map((step, index) => (
          <li key={step.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <strong>{actionLabels[step.action]}</strong>
              {'target' in step ? <p>{DefinitionLabels.target(step.target)}</p> : null}
              <small>{DefinitionLabels.step(step)}</small>
              {'target' in step ? <details className="target-matching"><summary>Target matching</summary><ul>{step.target.candidates.map((candidate) => <li key={`${candidate.kind}-${candidate.selector}`}><span>{candidate.kind.replaceAll('_', ' ')}</span><code>{candidate.selector}</code></li>)}</ul></details> : null}
            </div>
          </li>
        ))}</ol>
      </section>

      <section className="definition-section" aria-labelledby={`${definition.name}-outcomes`}>
        <header><span>04</span><h3 id={`${definition.name}-outcomes`}>Expected outcomes</h3></header>
        <ul className="definition-outcomes">{definition.expectedEffects.map((effect, index) => (
          <li key={`${effect.kind}-${index}`}>{DefinitionLabels.expected(effect)}</li>
        ))}</ul>
      </section>

      <section className="definition-section" aria-labelledby={`${definition.name}-evidence`}>
        <header><span>05</span><h3 id={`${definition.name}-evidence`}>Evidence</h3></header>
        <div className="definition-evidence">
          <span>Human · {humanEvents} event{humanEvents === 1 ? '' : 's'}</span>
          <span>Agent · {agentEvents} event{agentEvents === 1 ? '' : 's'}</span>
          <span>Verifier · {verifierEvents} event{verifierEvents === 1 ? '' : 's'}</span>
        </div>
        {definition.traceReduction ? <p className="definition-reduction">{definition.traceReduction.rawEvents} raw events → {definition.traceReduction.compiledEvents} compiled steps · {definition.traceReduction.omittedEvents} redundant events omitted</p> : null}
      </section>
    </div>
  )
}
