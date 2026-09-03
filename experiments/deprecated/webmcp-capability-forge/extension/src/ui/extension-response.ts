import { JsonTypes, type JsonValue } from 'webmcp-capability-forge-core'

export class ExtensionResponse {
  static failure(value: JsonValue, fallback: string): string | null {
    if (!JsonTypes.isObject(value)) return fallback
    if (value.ok === true) return null
    return typeof value.message === 'string' && value.message.trim().length > 0
      ? value.message
      : fallback
  }
}
