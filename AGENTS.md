# Coding Rules

## TypeScript function exports

When a TypeScript file needs to export more than one function, gather those functions as static methods on a single exported class. Do not export multiple standalone functions from the same file.

```ts
export class UserNames {
  static normalize(value: string): string {
    return value.trim().toLowerCase()
  }

  static isValid(value: string): boolean {
    return value.trim().length > 0
  }
}
```

## Deterministic string values

Reduce raw string usage to the absolute minimum. String literal unions are forbidden. Define every deterministic set of string values as a string enum and use that enum exclusively throughout the codebase.

```ts
// Forbidden
type DeliveryStatus = 'pending' | 'delivered'

// Required
export enum DeliveryStatus {
  Pending = 'pending',
  Delivered = 'delivered',
}
```

Do not repeat the enum's underlying raw strings at call sites, in comparisons, or in branching logic. Use members such as `DeliveryStatus.Pending` instead.

## Absolute type safety

The `any` and `unknown` types are forbidden. Every value must have a concrete, explicit type before it enters application logic. Use specific interfaces, types, enums, generics, or validated schemas instead of weakening the type system with `any` or `unknown`.

```ts
// Forbidden
function processValue(value: any): unknown {
  return value
}

// Required
interface ProcessInput {
  readonly id: string
}

interface ProcessResult {
  readonly id: string
}

function processValue(value: ProcessInput): ProcessResult {
  return { id: value.id }
}
```
