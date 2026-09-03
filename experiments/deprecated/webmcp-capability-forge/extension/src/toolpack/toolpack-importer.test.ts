import { describe, expect, it } from 'vitest'

import {
  ToolPackFormat,
  VerificationStatus,
} from 'webmcp-capability-forge-core'

import { RepositoryTestFixtures } from '../storage/repository-test-fixtures'
import { ToolPackImporter } from './toolpack-importer'
import { JsonCodec } from '../storage/json-codec'

describe('ToolPackImporter', () => {
  it('validates a current pack against the active origin and resets verification for review', () => {
    const definition = RepositoryTestFixtures.capability(
      'https://shop.example', 4, VerificationStatus.ReplayVerified,
    )
    const result = ToolPackImporter.convert(JsonCodec.value({
      format: ToolPackFormat.CapabilityForge,
      schemaVersion: 1,
      exportedAt: '2026-08-29T00:00:00.000Z',
      origin: 'https://shop.example',
      tools: [definition],
    }), { origin: 'https://shop.example', path: '/catalog' })

    expect(result.valid).toBe(true)
    if (result.valid) expect(result.value[0]?.verification.status).toBe(VerificationStatus.Proposed)
  })

  it('rejects a current pack from another origin', () => {
    const definition = RepositoryTestFixtures.capability(
      'https://other.example', 1, VerificationStatus.ReplayVerified,
    )
    const result = ToolPackImporter.convert(JsonCodec.value({
      format: ToolPackFormat.CapabilityForge,
      schemaVersion: 1,
      exportedAt: '2026-08-29T00:00:00.000Z',
      origin: 'https://other.example',
      tools: [definition],
    }), { origin: 'https://shop.example', path: '/catalog' })

    expect(result.valid).toBe(false)
  })
})
