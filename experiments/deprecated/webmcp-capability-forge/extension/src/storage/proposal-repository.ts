import {
  JsonTypes,
  SchemaCatalog,
  type CapabilityDefinition,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import { JsonCodec } from './json-codec'
import type { StorageArea } from './storage-area'

enum StorageKey {
  Proposals = 'webmcp-capability-forge:proposals:v1',
}

export enum ProposalStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Expired = 'expired',
}

export interface ProposalRecord {
  readonly requestId: string
  readonly sessionId: string
  readonly status: ProposalStatus
  readonly definition: CapabilityDefinition
  readonly createdAt: number
  readonly expiresAt: number
}

export class ProposalRepository {
  private readonly storage: StorageArea
  constructor(storage: StorageArea) { this.storage = storage }

  async save(record: ProposalRecord): Promise<void> {
    const records = (await this.read()).filter((candidate) => candidate.requestId !== record.requestId)
    records.push(structuredClone(record))
    await this.write(records)
  }

  async get(requestId: string): Promise<ProposalRecord | null> {
    const record = (await this.read()).find((candidate) => candidate.requestId === requestId)
    return record ? structuredClone(record) : null
  }

  async listPending(origin: string): Promise<readonly ProposalRecord[]> {
    return (await this.read()).filter((record) =>
      record.status === ProposalStatus.Pending && record.definition.scope.origin === origin,
    ).map((record) => structuredClone(record))
  }

  async listOrigin(origin: string): Promise<readonly ProposalRecord[]> {
    return (await this.read()).filter((record) =>
      record.definition.scope.origin === origin,
    ).map((record) => structuredClone(record))
  }

  async resolve(requestId: string, status: ProposalStatus): Promise<ProposalRecord> {
    const record = await this.get(requestId)
    if (!record) throw new Error('Pending proposal was not found.')
    const resolved = { ...record, status }
    await this.save(resolved)
    return resolved
  }

  private async read(): Promise<ProposalRecord[]> {
    const stored = await this.storage.get(StorageKey.Proposals)
    const value = stored[StorageKey.Proposals]
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
      const record = ProposalRepository.parse(item)
      return record ? [record] : []
    })
  }

  private async write(records: readonly ProposalRecord[]): Promise<void> {
    await this.storage.set(JsonCodec.object({ [StorageKey.Proposals]: records }))
  }

  private static parse(value: JsonValue): ProposalRecord | null {
    if (
      !JsonTypes.isObject(value) || typeof value.requestId !== 'string' ||
      typeof value.sessionId !== 'string' || typeof value.status !== 'string' ||
      !Object.values(ProposalStatus).includes(value.status as ProposalStatus) ||
      value.definition === undefined || typeof value.createdAt !== 'number' ||
      typeof value.expiresAt !== 'number'
    ) return null
    const definition = SchemaCatalog.parseCapability(value.definition)
    if (!definition.valid) return null
    return {
      requestId: value.requestId,
      sessionId: value.sessionId,
      status: value.status as ProposalStatus,
      definition: definition.value,
      createdAt: value.createdAt,
      expiresAt: value.expiresAt,
    }
  }
}
