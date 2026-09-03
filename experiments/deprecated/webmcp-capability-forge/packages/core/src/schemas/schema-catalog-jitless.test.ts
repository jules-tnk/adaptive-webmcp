import { expect, it } from 'vitest'

it('loads and validates schemas without probing dynamic code generation', async () => {
  const originalFunction = globalThis.Function
  let probeAttempted = false
  const probeDetector = new Proxy(originalFunction, {
    apply(): never {
      probeAttempted = true
      throw new Error('Dynamic code generation is blocked.')
    },
    construct(): never {
      probeAttempted = true
      throw new Error('Dynamic code generation is blocked.')
    },
  })
  globalThis.Function = probeDetector

  try {
    const { SchemaCatalog } = await import('./schema-catalog')
    SchemaCatalog.parseSession(null)

    expect(probeAttempted).toBe(false)
  } finally {
    globalThis.Function = originalFunction
  }
})
