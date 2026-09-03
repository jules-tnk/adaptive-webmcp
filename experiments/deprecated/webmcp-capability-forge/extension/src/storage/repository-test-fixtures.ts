import {
  CapabilityClassification,
  ExpectedEffectKind,
  ExtractSource,
  JsonSchemaType,
  LearningMode,
  SelectorKind,
  SemanticRole,
  SessionActor,
  SessionMachine,
  VerificationStatus,
  WorkflowAction,
  type CapabilityDefinition,
  type LearningSession,
  type TargetStrategy,
} from 'webmcp-capability-forge-core'

const target: TargetStrategy = {
  role: SemanticRole.Textbox,
  name: 'Result',
  candidates: [
    {
      kind: SelectorKind.AccessibleRole,
      selector: '[aria-label="Result"]',
      score: 100,
      uniqueAtRecording: true,
    },
  ],
}

export class RepositoryTestFixtures {
  static session(id: string, origin: string): LearningSession {
    return SessionMachine.start(
      {
        goal: 'Read a result',
        origin,
        path: '/catalog',
        mode: LearningMode.Hybrid,
        actor: SessionActor.Human,
      },
      { now: () => 1000, createId: () => id },
    )
  }

  static capability(
    origin: string,
    revision: number,
    status: VerificationStatus,
  ): CapabilityDefinition {
    return {
      schemaVersion: 1,
      name: 'read_result',
      title: 'Read result',
      description: 'Read a visible result.',
      scope: { origin, pathPatterns: ['/catalog*'] },
      inputSchema: {
        type: JsonSchemaType.Object,
        properties: {},
        required: [],
        additionalProperties: false,
      },
      classification: CapabilityClassification.Read,
      steps: [
        {
          id: 'step-1',
          action: WorkflowAction.Extract,
          target,
          fields: [{ name: 'text', source: ExtractSource.Text }],
          saveAs: 'result',
        },
      ],
      expectedEffects: [{ kind: ExpectedEffectKind.ElementVisible, target }],
      provenanceSummary: { humanEvents: 1, agentEvents: 0, verifierEvents: 0 },
      verification: { status, attempts: [] },
      revision,
    }
  }
}
