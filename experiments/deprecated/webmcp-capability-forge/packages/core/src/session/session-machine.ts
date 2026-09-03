import {
  FailureCode,
  ValidationIssueCode,
  type ValidationResult,
} from '../contracts/error-contracts'
import {
  LearningMode,
  SessionRecoveryAction,
  SessionStatus,
  TraceSource,
  type LearningSession,
  type SessionActor,
  type SessionDependencies,
  type StartSessionInput,
  type TraceEvent,
} from '../contracts/session-contracts'

const maximumAgentActions = 20
const sessionDurationMs = 600_000

const allowedTransitions: Readonly<Record<SessionStatus, readonly SessionStatus[]>> = {
  [SessionStatus.Idle]: [SessionStatus.AwaitingStartApproval, SessionStatus.Collecting],
  [SessionStatus.AwaitingStartApproval]: [
    SessionStatus.Collecting,
    SessionStatus.Rejected,
    SessionStatus.Paused,
  ],
  [SessionStatus.Collecting]: [
    SessionStatus.Drafting,
    SessionStatus.Paused,
    SessionStatus.Failed,
  ],
  [SessionStatus.Drafting]: [
    SessionStatus.AwaitingReview,
    SessionStatus.Paused,
    SessionStatus.Failed,
  ],
  [SessionStatus.AwaitingReview]: [
    SessionStatus.Verifying,
    SessionStatus.Rejected,
    SessionStatus.Paused,
  ],
  [SessionStatus.Verifying]: [
    SessionStatus.Active,
    SessionStatus.Failed,
    SessionStatus.Paused,
  ],
  [SessionStatus.Active]: [SessionStatus.Paused, SessionStatus.Failed],
  [SessionStatus.Paused]: [SessionStatus.Collecting, SessionStatus.Rejected],
  [SessionStatus.Rejected]: [],
  [SessionStatus.Failed]: [SessionStatus.Collecting, SessionStatus.Rejected],
}

export class SessionMachine {
  static start(
    input: StartSessionInput,
    dependencies: SessionDependencies,
  ): LearningSession {
    const timestamp = dependencies.now()
    return {
      schemaVersion: 1,
      id: dependencies.createId(),
      goal: input.goal,
      origin: input.origin,
      startPath: input.path,
      currentPath: input.path,
      mode: input.mode,
      actor: input.actor,
      status: SessionStatus.Collecting,
      trace: [],
      agentActionCount: 0,
      startedAt: timestamp,
      updatedAt: timestamp,
      expiresAt: timestamp + sessionDurationMs,
    }
  }

  static append(
    session: LearningSession,
    event: TraceEvent,
  ): ValidationResult<LearningSession> {
    if (
      session.status !== SessionStatus.Collecting &&
      session.status !== SessionStatus.Verifying
    ) {
      return SessionMachine.invalidTransition(session.status, session.status)
    }

    const agentActionCount =
      session.agentActionCount + (event.source === TraceSource.Agent ? 1 : 0)
    const sources = new Set([...session.trace.map((item) => item.source), event.source])
    const mode = sources.has(TraceSource.Human) && sources.has(TraceSource.Agent)
      ? LearningMode.Hybrid
      : session.mode
    const next: LearningSession = {
      ...structuredClone(session),
      trace: [...structuredClone(session.trace), structuredClone(event)],
      currentPath: event.path,
      agentActionCount,
      mode,
      updatedAt: event.timestamp,
    }

    if (agentActionCount >= maximumAgentActions) {
      return { valid: true, value: SessionMachine.pause(next, FailureCode.SessionLimitReached) }
    }
    return { valid: true, value: next }
  }

  static handoff(
    session: LearningSession,
    actor: SessionActor,
  ): ValidationResult<LearningSession> {
    if (session.status !== SessionStatus.Collecting) {
      return SessionMachine.invalidTransition(session.status, SessionStatus.Collecting)
    }
    return {
      valid: true,
      value: { ...structuredClone(session), actor },
    }
  }

  static transition(
    session: LearningSession,
    status: SessionStatus,
  ): ValidationResult<LearningSession> {
    if (status === session.status) return { valid: true, value: structuredClone(session) }
    if (!allowedTransitions[session.status].includes(status)) {
      return SessionMachine.invalidTransition(session.status, status)
    }
    return {
      valid: true,
      value: { ...structuredClone(session), status },
    }
  }

  static pause(session: LearningSession, reason: FailureCode): LearningSession {
    return {
      ...structuredClone(session),
      status: SessionStatus.Paused,
      pauseReason: reason,
      recoveryActions: [
        SessionRecoveryAction.Stop,
        SessionRecoveryAction.HumanHandoff,
        SessionRecoveryAction.RequestExtension,
      ],
    }
  }

  static expire(session: LearningSession, currentTime: number): LearningSession {
    if (
      currentTime < session.expiresAt ||
      session.status === SessionStatus.Active ||
      session.status === SessionStatus.Rejected ||
      session.status === SessionStatus.Failed
    ) {
      return structuredClone(session)
    }
    return SessionMachine.pause(
      { ...structuredClone(session), updatedAt: currentTime },
      FailureCode.SessionLimitReached,
    )
  }

  private static invalidTransition(
    from: SessionStatus,
    to: SessionStatus,
  ): ValidationResult<never> {
    return {
      valid: false,
      failure: FailureCode.InvalidSessionTransition,
      issues: [
        {
          path: 'status',
          code: ValidationIssueCode.InvalidSessionTransition,
          message: `Cannot transition from ${from} to ${to}.`,
        },
      ],
    }
  }
}
