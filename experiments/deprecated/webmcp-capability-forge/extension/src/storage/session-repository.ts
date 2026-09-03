import {
  SchemaCatalog,
  FailureCode,
  SessionMachine,
  SessionStatus,
  JsonTypes,
  type JsonObject,
  type JsonValue,
  type LearningSession,
} from 'webmcp-capability-forge-core'

import { JsonCodec } from './json-codec'
import type { StorageArea } from './storage-area'

enum StorageKey {
  Sessions = 'webmcp-capability-forge:sessions:v1',
}

interface SessionEntry {
  readonly tabId: number
  readonly session: LearningSession
}

export interface SessionRepositoryDependencies {
  now(): number
}

export class SessionRepository {
  private readonly storage: StorageArea
  private readonly dependencies: SessionRepositoryDependencies

  constructor(
    storage: StorageArea,
    dependencies: SessionRepositoryDependencies = { now: () => Date.now() },
  ) {
    this.storage = storage
    this.dependencies = dependencies
  }

  async save(tabId: number, session: LearningSession): Promise<void> {
    const entries = await this.read()
    const next = entries.filter((entry) => entry.tabId !== tabId)
    next.push({ tabId, session: structuredClone(session) })
    await this.write(next)
  }

  async get(tabId: number): Promise<LearningSession | null> {
    const entry = (await this.read()).find((candidate) => candidate.tabId === tabId)
    if (!entry) return null
    const expired = SessionMachine.expire(entry.session, this.dependencies.now())
    if (expired.status !== entry.session.status) await this.save(tabId, expired)
    return structuredClone(expired)
  }

  async expireAll(): Promise<number> {
    const entries = await this.read()
    let expiredCount = 0
    const next = entries.map((entry) => {
      const session = SessionMachine.expire(entry.session, this.dependencies.now())
      if (session.status !== entry.session.status) expiredCount += 1
      return { tabId: entry.tabId, session }
    })
    if (expiredCount > 0) await this.write(next)
    return expiredCount
  }

  async pauseOnTabClose(tabId: number): Promise<void> {
    const entry = (await this.read()).find((candidate) => candidate.tabId === tabId)
    if (!entry || entry.session.status !== SessionStatus.Collecting) return
    await this.save(tabId, SessionMachine.pause(entry.session, FailureCode.NavigationInterrupted))
  }

  async remove(tabId: number): Promise<void> {
    await this.write((await this.read()).filter((entry) => entry.tabId !== tabId))
  }

  private async read(): Promise<SessionEntry[]> {
    const stored = await this.storage.get(StorageKey.Sessions)
    const value = stored[StorageKey.Sessions]
    if (!Array.isArray(value)) return []
    const entries: SessionEntry[] = []
    for (const item of value) {
      const object = SessionRepository.asObject(item)
      if (!object || typeof object.tabId !== 'number' || object.session === undefined) continue
      const parsed = SchemaCatalog.parseSession(object.session)
      if (parsed.valid) entries.push({ tabId: object.tabId, session: parsed.value })
    }
    return entries
  }

  private async write(entries: readonly SessionEntry[]): Promise<void> {
    await this.storage.set(
      JsonCodec.object({
        [StorageKey.Sessions]: entries.map((entry) => ({
          tabId: entry.tabId,
          session: JsonCodec.value(entry.session),
        })),
      }),
    )
  }

  private static asObject(value: JsonValue): JsonObject | null {
    return JsonTypes.isObject(value) ? value : null
  }
}
