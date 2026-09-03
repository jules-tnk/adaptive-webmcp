import type { ModelContextLike } from './model-context-adapter'

declare global {
  interface Document {
    readonly modelContext?: ModelContextLike
  }
}

export {}
