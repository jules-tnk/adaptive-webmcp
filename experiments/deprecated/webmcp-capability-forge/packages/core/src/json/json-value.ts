export type JsonScalar = string | number | boolean | null
export type JsonObject = { readonly [key: string]: JsonValue }
export type JsonValue = JsonScalar | JsonObject | readonly JsonValue[]

export class JsonTypes {
  static isObject(value: JsonValue | undefined): value is JsonObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }
}
