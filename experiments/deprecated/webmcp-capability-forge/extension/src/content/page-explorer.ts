import {
  CapabilityClassification,
  FailureCode,
  InteractionEffect,
  RiskPhase,
  RiskPolicy,
  TraceSource,
  WorkflowAction,
  type PageInspection,
  type BoundedObservation,
  type SessionDependencies,
  type TargetHandle,
  type TraceEvent,
} from 'webmcp-capability-forge-core'

import { PageObserver } from './page-observer'
import { SemanticInventory } from './semantic-inventory'
import { SensitiveTargetPolicy } from './sensitive-target-policy'

export interface ExplorationRequest {
  readonly documentValue: Document
  readonly handle: TargetHandle
  readonly action: WorkflowAction
  readonly effect?: InteractionEffect
  readonly phase: RiskPhase
  readonly confirmed: boolean
  readonly origin: string
  readonly path: string
  readonly value?: string
  readonly checked?: boolean
  readonly key?: string
}

export interface ExplorationFailure {
  readonly code: FailureCode
  readonly message: string
}

export interface ExplorationResult {
  readonly ok: boolean
  readonly event?: TraceEvent
  readonly failure?: ExplorationFailure
}

export class PageExplorer {
  private readonly dependencies: SessionDependencies

  constructor(dependencies: SessionDependencies) {
    this.dependencies = dependencies
  }

  inspect(documentValue: Document): PageInspection {
    return SemanticInventory.inspect(documentValue)
  }

  async interact(request: ExplorationRequest): Promise<ExplorationResult> {
    const resolved = SemanticInventory.resolve(request.documentValue, request.handle)
    if (!resolved.valid) {
      return {
        ok: false,
        failure: {
          code: resolved.failure ?? FailureCode.TargetMissing,
          message: resolved.issues[0]?.message ?? 'Target is unavailable.',
        },
      }
    }
    const sensitive = SensitiveTargetPolicy.classify(resolved.value).blocked
    const classification = PageExplorer.classification(request)
    const authorized = RiskPolicy.authorize({
      classification,
      phase: request.phase,
      confirmed: request.confirmed,
      sensitiveTarget: sensitive,
    })
    if (!authorized.allowed) return { ok: false, failure: authorized.failure }

    PageExplorer.perform(resolved.value, request)
    const inspection = SemanticInventory.inspect(request.documentValue)
    const target = inspection.targets.find((candidate) => {
      const current = SemanticInventory.resolve(request.documentValue, candidate.handle)
      return current.valid && current.value === resolved.value
    })
    const event: TraceEvent = {
      id: this.dependencies.createId(),
      source: TraceSource.Agent,
      action: request.action,
      ...(target ? { target: target.strategy } : {}),
      ...(request.value ? { inputReference: 'input_1' } : {}),
      origin: request.origin,
      path: request.path,
      timestamp: this.dependencies.now(),
    }
    return { ok: true, event }
  }

  observe(documentValue: Document): BoundedObservation {
    return PageObserver.capture(documentValue.body)
  }

  private static classification(request: ExplorationRequest): CapabilityClassification {
    if (request.effect === InteractionEffect.Sensitive) return CapabilityClassification.BlockedSensitive
    if (
      request.effect === InteractionEffect.FormSubmission ||
      request.effect === InteractionEffect.Message ||
      request.effect === InteractionEffect.Purchase ||
      request.effect === InteractionEffect.Deletion ||
      request.effect === InteractionEffect.AccountChange
    ) {
      return CapabilityClassification.ExternalWrite
    }
    if (request.effect === InteractionEffect.Navigation) return CapabilityClassification.Navigation
    if (
      request.action === WorkflowAction.Extract ||
      request.action === WorkflowAction.WaitFor ||
      request.action === WorkflowAction.WaitForUrl ||
      request.action === WorkflowAction.ScrollIntoView
    ) {
      return CapabilityClassification.Read
    }
    return CapabilityClassification.LocalUi
  }

  private static perform(element: Element, request: ExplorationRequest): void {
    if (request.action === WorkflowAction.Click && element instanceof HTMLElement) {
      element.click()
      return
    }
    if (request.action === WorkflowAction.Fill && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      element.value = request.value ?? ''
      element.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
    if (request.action === WorkflowAction.Select && element instanceof HTMLSelectElement) {
      element.value = request.value ?? ''
      element.dispatchEvent(new Event('change', { bubbles: true }))
      return
    }
    if (request.action === WorkflowAction.Check && element instanceof HTMLInputElement) {
      element.checked = request.checked === true
      element.dispatchEvent(new Event('change', { bubbles: true }))
      return
    }
    if (request.action === WorkflowAction.Keypress) {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: request.key ?? '', bubbles: true }))
      return
    }
    if (request.action === WorkflowAction.ScrollIntoView && element instanceof HTMLElement) {
      element.scrollIntoView?.({ block: 'center' })
    }
  }
}
