import { describe, expect, it } from 'vitest'

import { ContentScriptRunAt, ContentScriptWorld } from './site-permissions'
import {
  SitePermissions,
  type ContentRegistration,
  type SitePermissionPlatform,
} from './site-permissions'

class FakePermissionPlatform implements SitePermissionPlatform {
  requested: string[] = []
  registrations: ContentRegistration[] = []
  granted = true
  persisted = true

  async request(pattern: string): Promise<boolean> {
    this.requested.push(pattern)
    return this.granted
  }

  async register(registration: ContentRegistration): Promise<void> {
    this.registrations.push(registration)
  }

  async unregister(id: string): Promise<void> {
    this.registrations = this.registrations.filter((registration) => registration.id !== id)
  }

  async remove(): Promise<boolean> {
    return true
  }

  async contains(pattern: string): Promise<boolean> {
    return this.persisted && this.requested.includes(pattern)
  }

  async registered(id: string): Promise<boolean> {
    return this.registrations.some((registration) => registration.id === id)
  }
}

describe('SitePermissions', () => {
  it('requests a host pattern without the port while retaining the exact origin', async () => {
    const platform = new FakePermissionPlatform()
    const permissions = new SitePermissions(platform)

    const result = await permissions.enable('http://127.0.0.1:4174/catalog')

    expect(result.enabled).toBe(true)
    expect(result.origin).toBe('http://127.0.0.1:4174')
    expect(platform.requested).toEqual(['http://127.0.0.1/*'])
    expect(platform.registrations[0]).toMatchObject({
      matches: ['http://127.0.0.1/*'],
      runAt: ContentScriptRunAt.DocumentStart,
      world: ContentScriptWorld.Isolated,
      persistAcrossSessions: true,
    })
  })

  it('does not register content when the user denies host access', async () => {
    const platform = new FakePermissionPlatform()
    platform.granted = false
    const permissions = new SitePermissions(platform)

    const result = await permissions.enable('https://shop.example/catalog')

    expect(result.enabled).toBe(false)
    expect(platform.registrations).toEqual([])
  })

  it('does not report enabled when Chrome does not persist the requested host access', async () => {
    const platform = new FakePermissionPlatform()
    platform.persisted = false
    const permissions = new SitePermissions(platform)

    const result = await permissions.enable('https://www.youtube.com/@TheGreatReview/videos')

    expect(result.enabled).toBe(false)
    expect(platform.registrations).toEqual([])
  })

  it('restores content registration when the host permission remains granted', async () => {
    const platform = new FakePermissionPlatform()
    const permissions = new SitePermissions(platform)
    const url = 'https://www.youtube.com/@TheGreatReview/videos'
    await permissions.enable(url)
    platform.registrations = []

    const result = await permissions.status(url)

    expect(result.enabled).toBe(true)
    expect(result.registrationChanged).toBe(true)
    expect(platform.registrations).toHaveLength(1)
    expect(platform.registrations[0]?.matches).toEqual(['https://www.youtube.com/*'])
  })
})
