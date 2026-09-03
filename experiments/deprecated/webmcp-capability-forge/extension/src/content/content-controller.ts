import {
  JsonTypes,
  SchemaCatalog,
  type JsonObject,
  type JsonValue,
  type LearningSession,
  type PageInspection,
  type ExecutionOutcome,
} from 'webmcp-capability-forge-core'

import { JsonCodec } from '../storage/json-codec'
import { ManualRecorder } from './manual-recorder'
import { PageExplorer, type ExplorationRequest, type ExplorationResult } from './page-explorer'
import { WorkflowExecutor, type WorkflowExecutionRequest } from './workflow-executor'
import { WorkflowPreflight, type WorkflowPreflightResult } from './workflow-preflight'

export class ContentController {
  private readonly recorder: ManualRecorder
  private readonly explorer: PageExplorer
  private readonly documentValue: Document
  private readonly executor = new WorkflowExecutor()

  constructor(
    recorder: ManualRecorder,
    explorer: PageExplorer,
    documentValue: Document,
  ) {
    this.recorder = recorder
    this.explorer = explorer
    this.documentValue = documentValue
  }

  startManual(sessionValue: JsonValue): JsonObject {
    const parsed = SchemaCatalog.parseSession(sessionValue)
    if (!parsed.valid) return { ok: false, issues: JsonCodec.value(parsed.issues) }
    this.recorder.start(parsed.value, this.documentValue)
    return { ok: true }
  }

  stopManual(): Promise<LearningSession> {
    return this.recorder.stop()
  }

  inspect(): PageInspection {
    return this.explorer.inspect(this.documentValue)
  }

  interact(request: ExplorationRequest): Promise<ExplorationResult> {
    return this.explorer.interact(request)
  }

  observe(): JsonObject {
    return JsonCodec.object(this.explorer.observe(this.documentValue))
  }

  execute(request: WorkflowExecutionRequest): Promise<ExecutionOutcome> {
    return this.executor.run(request)
  }

  preflight(definition: import('webmcp-capability-forge-core').CapabilityDefinition): WorkflowPreflightResult {
    return WorkflowPreflight.inspect(definition, this.documentValue)
  }

  cancel(executionId: string): void {
    this.executor.cancel(executionId)
  }

  dispose(): void {
    this.recorder.dispose()
  }

  static sessionFromPayload(payload: JsonValue): JsonValue | null {
    if (!JsonTypes.isObject(payload)) return null
    return payload.session ?? null
  }
}
