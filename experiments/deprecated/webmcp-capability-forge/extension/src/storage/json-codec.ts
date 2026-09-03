import { z } from 'zod'

import { JsonTypes, type JsonObject, type JsonValue } from 'webmcp-capability-forge-core'

export class JsonCodec {
  static value<T>(value: T): JsonValue {
    return z.json().parse(JSON.parse(JSON.stringify(value))) as JsonValue
  }

  static object<T>(value: T): JsonObject {
    const parsed = JsonCodec.value(value)
    if (!JsonTypes.isObject(parsed)) throw new Error('Expected a JSON object.')
    return parsed
  }
}
