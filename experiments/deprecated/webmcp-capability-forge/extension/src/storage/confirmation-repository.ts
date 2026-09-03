import {
  InteractionEffect,
  JsonTypes,
  WorkflowAction,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import { JsonCodec } from './json-codec'
import type { StorageArea } from './storage-area'

enum StorageKey {
  Confirmations = 'webmcp-capability-forge:confirmations:v1',
}

export enum ConfirmationStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Expired = 'expired',
  Consumed = 'consumed',
}

export interface ConfirmationRecord {
  readonly requestId: string
  readonly tabId: number
  readonly origin: string
  readonly path: string
  readonly action: WorkflowAction
  readonly effect: InteractionEffect
  readonly target: string
  readonly status: ConfirmationStatus
  readonly createdAt: number
  readonly expiresAt: number
}

export class ConfirmationRepository {
  private readonly storage: StorageArea
  constructor(storage: StorageArea) { this.storage = storage }

  async save(record: ConfirmationRecord): Promise<void> {
    const records = (await this.read()).filter((candidate) => candidate.requestId !== record.requestId)
    records.push(structuredClone(record))
    await this.write(records)
  }

  async get(requestId: string): Promise<ConfirmationRecord | null> {
    const record = (await this.read()).find((candidate) => candidate.requestId === requestId)
    return record ? structuredClone(record) : null
  }

  async listPending(origin: string): Promise<readonly ConfirmationRecord[]> {
    return (await this.read()).filter((record) =>
      record.origin === origin && record.status === ConfirmationStatus.Pending,
    ).map((record) => structuredClone(record))
  }

  async listOrigin(origin: string): Promise<readonly ConfirmationRecord[]> {
    return (await this.read()).filter((record) => record.origin === origin)
      .map((record) => structuredClone(record))
  }

  async resolve(requestId: string, status: ConfirmationStatus): Promise<ConfirmationRecord> {
    const record = await this.get(requestId)
    if (!record) throw new Error('Confirmation request was not found.')
    const resolved = { ...record, status }
    await this.save(resolved)
    return resolved
  }

  private async read(): Promise<ConfirmationRecord[]> {
    const stored = await this.storage.get(StorageKey.Confirmations)
    const value = stored[StorageKey.Confirmations]
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
      const parsed = ConfirmationRepository.parse(item)
      return parsed ? [parsed] : []
    })
  }

  private async write(records: readonly ConfirmationRecord[]): Promise<void> {
    await this.storage.set(JsonCodec.object({ [StorageKey.Confirmations]: records }))
  }

  private static parse(value: JsonValue): ConfirmationRecord | null {
    if (
      !JsonTypes.isObject(value) || typeof value.requestId !== 'string' ||
      typeof value.tabId !== 'number' || typeof value.origin !== 'string' ||
      typeof value.path !== 'string' || typeof value.action !== 'string' ||
      !Object.values(WorkflowAction).includes(value.action as WorkflowAction) ||
      typeof value.effect !== 'string' ||
      !Object.values(InteractionEffect).includes(value.effect as InteractionEffect) ||
      typeof value.target !== 'string' || typeof value.status !== 'string' ||
      !Object.values(ConfirmationStatus).includes(value.status as ConfirmationStatus) ||
      typeof value.createdAt !== 'number' || typeof value.expiresAt !== 'number'
    ) return null
    return {
      requestId: value.requestId,
      tabId: value.tabId,
      origin: value.origin,
      path: value.path,
      action: value.action as WorkflowAction,
      effect: value.effect as InteractionEffect,
      target: value.target,
      status: value.status as ConfirmationStatus,
      createdAt: value.createdAt,
      expiresAt: value.expiresAt,
    }
  }
}
