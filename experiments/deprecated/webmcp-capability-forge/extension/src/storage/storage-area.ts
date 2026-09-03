import type { JsonObject } from 'webmcp-capability-forge-core'

export interface StorageArea {
  get(key: string): Promise<JsonObject>
  set(values: JsonObject): Promise<void>
}
