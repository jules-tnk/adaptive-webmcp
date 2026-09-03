import { describe, expect, it } from 'vitest'

import { ToolPackFormat, VerificationStatus } from 'webmcp-capability-forge-core'

import { RepositoryTestFixtures } from '../storage/repository-test-fixtures'
import { ToolPackExporter } from './toolpack-exporter'

describe('ToolPackExporter', () => {
  it('exports definitions and revision metadata without sessions or failure history', () => {
    const definition = RepositoryTestFixtures.capability(
      'https://shop.example',
      3,
      VerificationStatus.ReplayVerified,
    )

    const pack = ToolPackExporter.create(
      'https://shop.example',
      [definition],
      '2026-08-29T00:00:00.000Z',
    )
    const serialized = JSON.stringify(pack)

    expect(pack.format).toBe(ToolPackFormat.CapabilityForge)
    expect(pack.origin).toBe('https://shop.example')
    expect(pack.tools[0]?.revision).toBe(3)
    expect(serialized).not.toContain('trace')
    expect(serialized).not.toContain('failure')
    expect(serialized).not.toContain('confirmation')
  })
})
