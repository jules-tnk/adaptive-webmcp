import type { JsonObject } from 'webmcp-capability-forge-core'

import { JsonCodec } from './json-codec'
import type { StorageArea } from './storage-area'

export class ChromeStorageArea implements StorageArea {
  async get(key: string): Promise<JsonObject> {
    const values = await chrome.storage.local.get(key)
    return JsonCodec.object(values)
  }

  async set(values: JsonObject): Promise<void> {
    await chrome.storage.local.set(values)
  }
}
