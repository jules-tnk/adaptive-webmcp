import {
  CapabilityClassification,
  ExpectedEffectKind,
  ExtractSource,
  JsonSchemaType,
  SelectorKind,
  SemanticRole,
  VerificationStatus,
  WorkflowAction,
  type CapabilityDefinition,
  type TargetStrategy,
} from '../index'

export const riskTarget: TargetStrategy = {
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

export const baseRiskCapability: CapabilityDefinition = {
  schemaVersion: 1,
  name: 'read_result',
  title: 'Read result',
  description: 'Read one visible result.',
  scope: { origin: 'https://shop.example', pathPatterns: ['/catalog*'] },
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
      target: riskTarget,
      fields: [{ name: 'text', source: ExtractSource.Text }],
      saveAs: 'result',
    },
  ],
  expectedEffects: [{ kind: ExpectedEffectKind.ElementVisible, target: riskTarget }],
  provenanceSummary: { humanEvents: 0, agentEvents: 1, verifierEvents: 0 },
  verification: { status: VerificationStatus.Proposed, attempts: [] },
  revision: 1,
}
