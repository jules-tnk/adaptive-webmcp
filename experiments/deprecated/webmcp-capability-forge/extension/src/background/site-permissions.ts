import { UrlProtocol } from 'webmcp-capability-forge-core'

export enum ContentScriptRunAt {
  DocumentStart = 'document_start',
}

export enum ContentScriptWorld {
  Isolated = 'ISOLATED',
}

export interface ContentRegistration {
  readonly id: string
  readonly matches: readonly string[]
  readonly js: readonly string[]
  readonly persistAcrossSessions: true
  readonly runAt: ContentScriptRunAt.DocumentStart
  readonly world: ContentScriptWorld.Isolated
}

export interface SitePermissionPlatform {
  request(pattern: string): Promise<boolean>
  register(registration: ContentRegistration): Promise<void>
  unregister(id: string): Promise<void>
  remove(pattern: string): Promise<boolean>
  contains(pattern: string): Promise<boolean>
  registered(id: string): Promise<boolean>
}

export interface SitePermissionResult {
  readonly enabled: boolean
  readonly origin: string
  readonly pattern: string
  readonly registrationId: string
  readonly registrationChanged: boolean
}

export class SitePermissions {
  private readonly platform: SitePermissionPlatform

  constructor(platform: SitePermissionPlatform) {
    this.platform = platform
  }

  async enable(url: string): Promise<SitePermissionResult> {
    const parsed = SitePermissions.parse(url)
    const pattern = SitePermissions.pattern(parsed)
    const registrationId = SitePermissions.registrationId(parsed.origin)
    const requested = await this.platform.request(pattern)
    const granted = requested && await this.platform.contains(pattern)
    if (!granted) return { enabled: false, origin: parsed.origin, pattern, registrationId, registrationChanged: false }

    await this.register(pattern, registrationId)
    return { enabled: true, origin: parsed.origin, pattern, registrationId, registrationChanged: true }
  }

  async disable(url: string): Promise<SitePermissionResult> {
    const parsed = SitePermissions.parse(url)
    const pattern = SitePermissions.pattern(parsed)
    const registrationId = SitePermissions.registrationId(parsed.origin)
    await this.platform.unregister(registrationId).catch(() => undefined)
    await this.platform.remove(pattern)
    return { enabled: false, origin: parsed.origin, pattern, registrationId, registrationChanged: false }
  }

  async status(url: string): Promise<SitePermissionResult> {
    const parsed = SitePermissions.parse(url)
    const pattern = SitePermissions.pattern(parsed)
    const registrationId = SitePermissions.registrationId(parsed.origin)
    const granted = await this.platform.contains(pattern)
    if (!granted) return { enabled: false, origin: parsed.origin, pattern, registrationId, registrationChanged: false }
    const registrationChanged = !(await this.platform.registered(registrationId))
    if (registrationChanged) {
      await this.register(pattern, registrationId)
    }
    return { enabled: true, origin: parsed.origin, pattern, registrationId, registrationChanged }
  }

  private async register(pattern: string, registrationId: string): Promise<void> {
    await this.platform.unregister(registrationId).catch(() => undefined)
    await this.platform.register({
      id: registrationId,
      matches: [pattern],
      js: ['content.js'],
      persistAcrossSessions: true,
      runAt: ContentScriptRunAt.DocumentStart,
      world: ContentScriptWorld.Isolated,
    })
  }

  private static parse(url: string): URL {
    const parsed = new URL(url)
    if (parsed.protocol !== UrlProtocol.Http && parsed.protocol !== UrlProtocol.Https) {
      throw new Error('Only HTTP and HTTPS sites can be enabled.')
    }
    return parsed
  }

  private static pattern(url: URL): string {
    return `${url.protocol}//${url.hostname}/*`
  }

  private static registrationId(origin: string): string {
    const encoded = btoa(origin)
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '')
    return `webmcp-capability-forge-${encoded}`
  }
}
