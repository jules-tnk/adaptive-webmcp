import {
  SessionMachine,
  InteractionEffect,
  TraceSource,
  TraceKeyKind,
  WorkflowAction,
  type LearningSession,
  type SessionDependencies,
  type TargetStrategy,
  type TraceEvent,
} from 'webmcp-capability-forge-core'

import { SemanticInventory } from './semantic-inventory'
import { SensitiveTargetPolicy } from './sensitive-target-policy'

export interface ManualTraceSink {
  append(event: TraceEvent): Promise<void>
}

class SilentManualTraceSink implements ManualTraceSink {
  async append(): Promise<void> {}
}

interface KeyboardModifiers {
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
}

enum NonTextInputType {
  Button = 'button',
  Checkbox = 'checkbox',
  Color = 'color',
  File = 'file',
  Hidden = 'hidden',
  Radio = 'radio',
  Range = 'range',
  Reset = 'reset',
  Submit = 'submit',
}

export class ManualRecorder {
  private readonly dependencies: SessionDependencies
  private root: Document | null = null
  private session: LearningSession | null = null
  private inputIndex = 0
  private readonly sink: ManualTraceSink
  private pending = Promise.resolve()
  private routeTimer: ReturnType<typeof setInterval> | null = null
  private lastPath = ''

  constructor(dependencies: SessionDependencies, sink: ManualTraceSink = new SilentManualTraceSink()) {
    this.dependencies = dependencies
    this.sink = sink
  }

  start(session: LearningSession, root: Document): void {
    this.dispose()
    this.session = structuredClone(session)
    this.root = root
    this.inputIndex = session.trace.filter((event) => event.inputReference).length
    this.pending = Promise.resolve()
    this.lastPath = session.currentPath
    root.addEventListener('input', this.onInput, true)
    root.addEventListener('change', this.onChange, true)
    root.addEventListener('click', this.onClick, true)
    root.addEventListener('keydown', this.onKeydown, true)
    this.routeTimer = setInterval(this.captureRouteChange, 200)
  }

  async stop(): Promise<LearningSession> {
    if (!this.session) throw new Error('No Manual recording session is active.')
    await this.pending
    const result = structuredClone(this.session)
    this.dispose()
    return result
  }

  dispose(): void {
    this.root?.removeEventListener('input', this.onInput, true)
    this.root?.removeEventListener('change', this.onChange, true)
    this.root?.removeEventListener('click', this.onClick, true)
    this.root?.removeEventListener('keydown', this.onKeydown, true)
    this.root = null
    if (this.routeTimer !== null) clearInterval(this.routeTimer)
    this.routeTimer = null
  }

  private readonly onInput = (event: Event): void => {
    if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return
    if (event.target instanceof HTMLInputElement && event.target.type === 'checkbox') return
    this.record(event.target, WorkflowAction.Fill, true)
  }

  private readonly onChange = (event: Event): void => {
    if (event.target instanceof HTMLSelectElement) {
      this.record(event.target, WorkflowAction.Select, true)
    } else if (event.target instanceof HTMLInputElement && event.target.type === 'checkbox') {
      this.record(event.target, WorkflowAction.Check, false)
    }
  }

  private readonly onClick = (event: Event): void => {
    if (!(event.target instanceof Element)) return
    const target = event.target.closest('button, a[href], [role="button"]')
    if (target) {
      this.record(
        target,
        WorkflowAction.Click,
        false,
        undefined,
        target.closest('a[href]') ? InteractionEffect.Navigation : undefined,
      )
    }
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (!(event.target instanceof Element) || !event.key) return
    const printable = event.key.length === 1 && !event.ctrlKey && !event.altKey &&
      !event.metaKey && ManualRecorder.textEntry(event.target)
    this.record(event.target, WorkflowAction.Keypress, false, printable ? undefined : event.key, undefined, {
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
    }, printable ? TraceKeyKind.Printable : undefined)
  }

  private record(
    element: Element,
    action: WorkflowAction,
    parameterized: boolean,
    key?: string,
    effect?: InteractionEffect,
    modifiers?: KeyboardModifiers,
    keyKind?: TraceKeyKind,
  ): void {
    if (!this.root || !this.session || SensitiveTargetPolicy.classify(element).blocked) return
    const target = ManualRecorder.strategy(this.root, element)
    if (!target) return
    if (parameterized) this.inputIndex += 1
    const traceEvent: TraceEvent = {
      id: this.dependencies.createId(),
      source: TraceSource.Human,
      action,
      target,
      ...(parameterized ? { inputReference: `input_${this.inputIndex}` } : {}),
      ...(key || effect || keyKind ? {
        data: {
          ...(key ? { key, ...(modifiers ?? {}) } : {}),
          ...(keyKind ? { keyKind, ...(modifiers ?? {}) } : {}),
          ...(effect ? { effect } : {}),
        },
      } : {}),
      ...ManualRecorder.page(this.root, this.session),
      timestamp: this.dependencies.now(),
    }
    const appended = SessionMachine.append(this.session, traceEvent)
    if (appended.valid) {
      this.session = appended.value
      this.pending = this.pending.then(() => this.sink.append(structuredClone(traceEvent)))
    }
  }

  private readonly captureRouteChange = (): void => {
    if (!this.root || !this.session) return
    const page = ManualRecorder.page(this.root, this.session)
    if (page.path === this.lastPath) return
    this.lastPath = page.path
    const traceEvent: TraceEvent = {
      id: this.dependencies.createId(),
      source: TraceSource.Human,
      action: WorkflowAction.WaitForUrl,
      origin: page.origin,
      path: page.path,
      timestamp: this.dependencies.now(),
    }
    const appended = SessionMachine.append(this.session, traceEvent)
    if (appended.valid) {
      this.session = appended.value
      this.pending = this.pending.then(() => this.sink.append(structuredClone(traceEvent)))
    }
  }

  private static strategy(root: Document, element: Element): TargetStrategy | null {
    const inspection = SemanticInventory.inspect(root)
    for (const target of inspection.targets) {
      const resolved = SemanticInventory.resolve(root, target.handle)
      if (resolved.valid && resolved.value === element) return target.strategy
    }
    return null
  }

  private static page(
    root: Document,
    session: LearningSession,
  ): { readonly origin: string; readonly path: string } {
    const location = root.defaultView?.location
    return location && location.origin === session.origin
      ? { origin: location.origin, path: location.pathname }
      : { origin: session.origin, path: session.currentPath }
  }

  private static textEntry(element: Element): boolean {
    if (element instanceof HTMLTextAreaElement) return true
    if (element instanceof HTMLInputElement) {
      return !Object.values(NonTextInputType).includes(element.type as NonTextInputType)
    }
    return element instanceof HTMLElement && element.isContentEditable
  }
}
