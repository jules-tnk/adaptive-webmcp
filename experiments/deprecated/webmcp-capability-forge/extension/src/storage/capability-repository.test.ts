import { describe, expect, it } from 'vitest'

import { VerificationStatus, type JsonObject } from 'webmcp-capability-forge-core'

import { CapabilityRevisionStatus, CapabilityRepository } from './capability-repository'
import { RepositoryTestFixtures } from './repository-test-fixtures'
import type { StorageArea } from './storage-area'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}

  async get(): Promise<JsonObject> {
    return structuredClone(this.values)
  }

  async set(values: JsonObject): Promise<void> {
    this.values = { ...this.values, ...structuredClone(values) }
  }
}

describe('CapabilityRepository', () => {
  it('allocates the next revision for the same origin and capability name', async () => {
    const repository = new CapabilityRepository(new MemoryStorageArea())
    const revisionOne = RepositoryTestFixtures.capability(
      'https://one.example',
      1,
      VerificationStatus.ReplayVerified,
    )
    const revisionThree = {
      ...RepositoryTestFixtures.capability(
        'https://one.example',
        3,
        VerificationStatus.Failed,
      ),
      name: revisionOne.name,
    }
    const otherOrigin = {
      ...RepositoryTestFixtures.capability(
        'https://two.example',
        9,
        VerificationStatus.ReplayVerified,
      ),
      name: revisionOne.name,
    }

    await repository.save(revisionOne, CapabilityRevisionStatus.Active)
    await repository.save(revisionThree, CapabilityRevisionStatus.Failed)
    await repository.save(otherOrigin, CapabilityRevisionStatus.Active)

    expect(await repository.nextRevision('https://one.example', revisionOne.name)).toBe(4)
    expect(await repository.nextRevision('https://one.example', 'new-capability')).toBe(1)
  })

  it('isolates origins and keeps the active revision when a replacement fails', async () => {
    const repository = new CapabilityRepository(new MemoryStorageArea())
    const first = RepositoryTestFixtures.capability(
      'https://one.example',
      1,
      VerificationStatus.ReplayVerified,
    )
    const replacement = RepositoryTestFixtures.capability(
      'https://one.example',
      2,
      VerificationStatus.Failed,
    )
    const otherOrigin = RepositoryTestFixtures.capability(
      'https://two.example',
      1,
      VerificationStatus.ReplayVerified,
    )

    await repository.save(first, CapabilityRevisionStatus.Active)
    await repository.save(replacement, CapabilityRevisionStatus.Failed)
    await repository.save(otherOrigin, CapabilityRevisionStatus.Active)

    expect((await repository.getActive('https://one.example', first.name))?.revision).toBe(1)
    expect(await repository.listOrigin('https://one.example')).toHaveLength(2)
    expect(await repository.listOrigin('https://two.example')).toHaveLength(1)
  })

  it('disables, re-enables, and removes a specific revision', async () => {
    const repository = new CapabilityRepository(new MemoryStorageArea())
    const definition = RepositoryTestFixtures.capability(
      'https://one.example', 1, VerificationStatus.ReplayVerified,
    )
    await repository.save(definition, CapabilityRevisionStatus.Active)

    await repository.setStatus('https://one.example', definition.name, 1, CapabilityRevisionStatus.Disabled)
    expect(await repository.getActive('https://one.example', definition.name)).toBeNull()
    await repository.setStatus('https://one.example', definition.name, 1, CapabilityRevisionStatus.Active)
    expect((await repository.getActive('https://one.example', definition.name))?.revision).toBe(1)
    await repository.remove('https://one.example', definition.name, 1)
    expect(await repository.listOrigin('https://one.example')).toHaveLength(0)
  })
})
