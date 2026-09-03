import { describe, expect, it } from 'vitest'

import { FailureCode } from 'webmcp-capability-forge-core'

import { ExtensionResponse } from './extension-response'

describe('ExtensionResponse', () => {
  it('returns the background failure message for an unsuccessful response', () => {
    expect(ExtensionResponse.failure({
      ok: false,
      code: FailureCode.ExecutionError,
      message: 'A recorded trace is required.',
    }, 'Fallback')).toBe('A recorded trace is required.')
  })

  it('returns the fallback for a successful or malformed response', () => {
    expect(ExtensionResponse.failure({ ok: true }, 'Fallback')).toBeNull()
    expect(ExtensionResponse.failure(null, 'Fallback')).toBe('Fallback')
  })
})
