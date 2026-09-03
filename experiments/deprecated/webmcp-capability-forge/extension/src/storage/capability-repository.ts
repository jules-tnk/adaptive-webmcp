import {
  FailureCode,
  SchemaCatalog,
  JsonTypes,
  type CapabilityDefinition,
  type JsonObject,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import { JsonCodec } from './json-codec'
import type { StorageArea } from './storage-area'

enum StorageKey {
  Capabilities = 'webmcp-capability-forge:capabilities:v1',
}

export enum CapabilityRevisionStatus {
  Proposed = 'proposed',
  Active = 'active',
  Failed = 'failed',
  Superseded = 'superseded',
  Guarded = 'guarded',
  Disabled = 'disabled',
}

export enum CapabilityHealth {
  Healthy = 'healthy',
  Stale = 'stale',
  Failed = 'failed',
  Unknown = 'unknown',
}

export interface CapabilityFailureRecord {
  readonly code: FailureCode
  readonly message: string
  readonly failedStep?: number
}

export interface CapabilityRevisionRecord {
  readonly origin: string
  readonly name: string
  readonly status: CapabilityRevisionStatus
  readonly definition: CapabilityDefinition
  readonly health: CapabilityHealth
  readonly failure?: CapabilityFailureRecord
}

export class CapabilityRepository {
  private readonly storage: StorageArea

  constructor(storage: StorageArea) {
    this.storage = storage
  }

  async save(
    definition: CapabilityDefinition,
    status: CapabilityRevisionStatus,
  ): Promise<void> {
    const records = await this.read()
    const next = records.filter(
      (record) =>
        !(
          record.origin === definition.scope.origin &&
          record.name === definition.name &&
          record.definition.revision === definition.revision
        ),
    )
    if (status === CapabilityRevisionStatus.Active) {
      for (const [index, record] of next.entries()) {
        if (
          record.origin === definition.scope.origin &&
          record.name === definition.name &&
          record.status === CapabilityRevisionStatus.Active
        ) {
          next[index] = { ...record, status: CapabilityRevisionStatus.Superseded }
        }
      }
    }
    next.push({
      origin: definition.scope.origin,
      name: definition.name,
      status,
      definition: structuredClone(definition),
      health:
        status === CapabilityRevisionStatus.Active
          ? CapabilityHealth.Healthy
          : status === CapabilityRevisionStatus.Failed
            ? CapabilityHealth.Failed
            : CapabilityHealth.Unknown,
    })
    await this.write(next)
  }

  async getActive(origin: string, name: string): Promise<CapabilityDefinition | null> {
    const record = (await this.read()).find(
      (candidate) =>
        candidate.origin === origin &&
        candidate.name === name &&
        candidate.status === CapabilityRevisionStatus.Active,
    )
    return record ? structuredClone(record.definition) : null
  }

  async nextRevision(origin: string, name: string): Promise<number> {
    const revisions = (await this.read())
      .filter((record) => record.origin === origin && record.name === name)
      .map((record) => record.definition.revision)
    return revisions.length === 0 ? 1 : Math.max(...revisions) + 1
  }

  async setStatus(
    origin: string,
    name: string,
    revision: number,
    status: CapabilityRevisionStatus,
  ): Promise<void> {
    const records = await this.read()
    const index = records.findIndex((record) =>
      record.origin === origin && record.name === name && record.definition.revision === revision,
    )
    const current = records[index]
    if (index < 0 || !current) throw new Error('Capability revision was not found.')
    if (status === CapabilityRevisionStatus.Active) {
      for (const [recordIndex, record] of records.entries()) {
        if (record.origin === origin && record.name === name && record.status === CapabilityRevisionStatus.Active) {
          records[recordIndex] = { ...record, status: CapabilityRevisionStatus.Superseded }
        }
      }
    }
    records[index] = {
      ...current,
      status,
      health: status === CapabilityRevisionStatus.Active ? CapabilityHealth.Healthy : current.health,
    }
    await this.write(records)
  }

  async remove(origin: string, name: string, revision: number): Promise<void> {
    await this.write((await this.read()).filter((record) => !(
      record.origin === origin && record.name === name && record.definition.revision === revision
    )))
  }

  async listOrigin(origin: string): Promise<readonly CapabilityRevisionRecord[]> {
    return (await this.read())
      .filter((record) => record.origin === origin)
      .map((record) => structuredClone(record))
  }

  async getRecord(
    origin: string,
    name: string,
    revision: number,
  ): Promise<CapabilityRevisionRecord | null> {
    const record = (await this.read()).find(
      (candidate) =>
        candidate.origin === origin &&
        candidate.name === name &&
        candidate.definition.revision === revision,
    )
    return record ? structuredClone(record) : null
  }

  async recordFailure(
    origin: string,
    name: string,
    revision: number,
    failure: CapabilityFailureRecord,
  ): Promise<void> {
    const records = await this.read()
    const index = records.findIndex(
      (record) =>
        record.origin === origin &&
        record.name === name &&
        record.definition.revision === revision,
    )
    if (index < 0) throw new Error('Capability revision was not found.')
    const current = records[index]
    if (!current) throw new Error('Capability revision was not found.')
    records[index] = {
      ...current,
      health:
        failure.code === FailureCode.StaleRevision || failure.code === FailureCode.TargetMissing
          ? CapabilityHealth.Stale
          : CapabilityHealth.Failed,
      failure: structuredClone(failure),
    }
    await this.write(records)
  }

  private async read(): Promise<CapabilityRevisionRecord[]> {
    const stored = await this.storage.get(StorageKey.Capabilities)
    const value = stored[StorageKey.Capabilities]
    if (!Array.isArray(value)) return []
    const records: CapabilityRevisionRecord[] = []
    for (const item of value) {
      const object = CapabilityRepository.asObject(item)
      if (!object) continue
      if (
        typeof object.origin !== 'string' ||
        typeof object.name !== 'string' ||
        typeof object.status !== 'string' ||
        object.definition === undefined ||
        !Object.values(CapabilityRevisionStatus).includes(
          object.status as CapabilityRevisionStatus,
        )
      ) {
        continue
      }
      const parsed = SchemaCatalog.parseCapability(object.definition)
      if (!parsed.valid) continue
      records.push({
        origin: object.origin,
        name: object.name,
        status: object.status as CapabilityRevisionStatus,
        definition: parsed.value,
        health:
          typeof object.health === 'string' &&
          Object.values(CapabilityHealth).includes(object.health as CapabilityHealth)
            ? (object.health as CapabilityHealth)
            : CapabilityHealth.Unknown,
        ...(JsonTypes.isObject(object.failure) &&
        typeof object.failure.code === 'string' &&
        Object.values(FailureCode).includes(object.failure.code as FailureCode) &&
        typeof object.failure.message === 'string'
          ? {
              failure: {
                code: object.failure.code as FailureCode,
                message: object.failure.message,
                ...(typeof object.failure.failedStep === 'number'
                  ? { failedStep: object.failure.failedStep }
                  : {}),
              },
            }
          : {}),
      })
    }
    return records
  }

  private async write(records: readonly CapabilityRevisionRecord[]): Promise<void> {
    await this.storage.set(
      JsonCodec.object({
        [StorageKey.Capabilities]: records.map((record) => ({
          origin: record.origin,
          name: record.name,
          status: record.status,
          definition: JsonCodec.value(record.definition),
          health: record.health,
          ...(record.failure ? { failure: JsonCodec.value(record.failure) } : {}),
        })),
      }),
    )
  }

  private static asObject(value: JsonValue): JsonObject | null {
    return JsonTypes.isObject(value) ? value : null
  }
}
