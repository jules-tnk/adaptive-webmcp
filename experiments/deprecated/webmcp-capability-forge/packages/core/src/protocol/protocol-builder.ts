import {
  BootstrapOperation,
  ProtocolPhase,
  type LearningProtocol,
  type ProtocolContext,
  type ProtocolNextCall,
} from '../contracts/protocol-contracts'
import { WorkflowAction } from '../contracts/workflow-contracts'

export class ProtocolBuilder {
  static inspect(context: ProtocolContext): LearningProtocol {
    return {
      protocolVersion: 1,
      instruction: `Begin by calling ${BootstrapOperation.Inspect}. Reuse a healthy tool before exploring.`,
      page: { origin: context.origin, path: context.path },
      phases: [
        { phase: ProtocolPhase.Reuse, instruction: 'Check existing tools and health first.' },
        { phase: ProtocolPhase.Explore, instruction: 'Inspect and interact within approved limits.' },
        { phase: ProtocolPhase.Model, instruction: 'Build one declarative workflow from the trace.' },
        { phase: ProtocolPhase.Propose, instruction: 'Submit the complete contract for human review.' },
        { phase: ProtocolPhase.Improve, instruction: 'Report failure and request reviewed repair.' },
      ],
      allowedActions: Object.values(WorkflowAction),
      constraints: {
        maximumExplorationActions: 20,
        maximumSessionMs: 600000,
        maximumObservationBytes: 32768,
        sameOriginOnly: true,
        executableCodeAllowed: false,
        humanApprovalRequired: true,
      },
      ...(context.session ? { session: structuredClone(context.session) } : {}),
      tools: structuredClone(context.tools),
      failures: structuredClone(context.failures),
      recentOutcomes: structuredClone(context.recentOutcomes),
      nextCalls: ProtocolBuilder.nextCalls(context),
    }
  }

  static nextCalls(_context: ProtocolContext): readonly ProtocolNextCall[] {
    return [
      { operation: BootstrapOperation.Inspect, when: 'You need current protocol and health.', requiredFields: [] },
      { operation: BootstrapOperation.BeginSession, when: 'No healthy matching tool exists for the current task.', requiredFields: ['goal'] },
      { operation: BootstrapOperation.JoinSession, when: 'A person has started teaching.', requiredFields: ['sessionId'] },
      { operation: BootstrapOperation.ListTools, when: 'You need a compact tool refresh.', requiredFields: [] },
      { operation: BootstrapOperation.ReportFailure, when: 'A learned tool failed or was wrong.', requiredFields: ['toolName', 'failure'] },
      { operation: BootstrapOperation.RequestRepair, when: 'A failed tool needs a replacement.', requiredFields: ['toolName'] },
    ]
  }
}
