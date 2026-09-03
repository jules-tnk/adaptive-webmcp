import {
  BridgeDirection,
  BridgeMessageType,
  LearningMode,
  type JsonObject,
  type JsonValue,
} from 'webmcp-capability-forge-core'
import type { CapabilityRevisionStatus } from '../storage/capability-repository'

import { BridgeEnvelopeCodec } from '../bridge/bridge-envelope'
import { JsonCodec } from '../storage/json-codec'

export interface ActivePage {
  readonly tabId: number
  readonly url: string
  readonly origin: string
  readonly path: string
}

export class ExtensionClient {
  async activePage(): Promise<ActivePage | null> {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const candidates = tabs.filter(
      (tab) => tab.id !== undefined && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://')),
    )
    const tab = candidates.find((candidate) => candidate.active) ?? candidates.at(-1)
    return tab?.id === undefined ? null : ExtensionClient.page(tab.id, tab.url)
  }

  async pageForTab(tabId: number): Promise<ActivePage | null> {
    const tab = await chrome.tabs.get(tabId)
    return ExtensionClient.page(tabId, tab.url)
  }

  siteStatus(page: ActivePage): Promise<JsonValue> {
    return this.send(BridgeMessageType.SiteStatus, { url: page.url, tabId: page.tabId })
  }

  enableSite(page: ActivePage): Promise<JsonValue> {
    return this.send(BridgeMessageType.SiteEnable, { url: page.url, tabId: page.tabId })
  }

  disableSite(page: ActivePage): Promise<JsonValue> {
    return this.send(BridgeMessageType.SiteDisable, { url: page.url, tabId: page.tabId })
  }

  beginSession(page: ActivePage, goal: string, mode: LearningMode): Promise<JsonValue> {
    return this.send(BridgeMessageType.SessionBegin, {
      tabId: page.tabId,
      origin: page.origin,
      path: page.path,
      goal,
      mode,
    })
  }

  getSession(page: ActivePage): Promise<JsonValue> {
    return this.send(BridgeMessageType.SessionGet, { tabId: page.tabId })
  }

  stopSession(page: ActivePage): Promise<JsonValue> {
    return this.send(BridgeMessageType.SessionStop, { tabId: page.tabId })
  }

  listCapabilities(page: ActivePage): Promise<JsonValue> {
    return this.send(BridgeMessageType.CapabilitiesList, { tabId: page.tabId, origin: page.origin, path: page.path })
  }

  resolveProposal(page: ActivePage, requestId: string, approved: boolean): Promise<JsonValue> {
    return this.send(BridgeMessageType.ProposalResolve, {
      tabId: page.tabId,
      requestId,
      approved,
    })
  }

  resolveConfirmation(page: ActivePage, requestId: string, approved: boolean): Promise<JsonValue> {
    return this.send(BridgeMessageType.ConfirmationResolve, {
      tabId: page.tabId,
      requestId,
      approved,
    })
  }

  setCapabilityStatus(
    page: ActivePage,
    name: string,
    revision: number,
    status: CapabilityRevisionStatus,
  ): Promise<JsonValue> {
    return this.send(BridgeMessageType.CapabilitySetStatus, {
      tabId: page.tabId, origin: page.origin, name, revision, status,
    })
  }

  deleteCapability(page: ActivePage, name: string, revision: number): Promise<JsonValue> {
    return this.send(BridgeMessageType.CapabilityDelete, {
      tabId: page.tabId, origin: page.origin, name, revision,
    })
  }

  exportToolPack(page: ActivePage, names: readonly string[]): Promise<JsonValue> {
    return this.send(BridgeMessageType.ToolPackExport, { origin: page.origin, names })
  }

  importToolPack(page: ActivePage, pack: JsonValue): Promise<JsonValue> {
    return this.send(BridgeMessageType.ToolPackImport, {
      tabId: page.tabId, origin: page.origin, path: page.path, pack,
    })
  }

  private async send(type: BridgeMessageType, payload: JsonObject): Promise<JsonValue> {
    const envelope = BridgeEnvelopeCodec.create({
      requestId: crypto.randomUUID(),
      direction: BridgeDirection.UiToBackground,
      type,
      payload,
    })
    const response = await chrome.runtime.sendMessage(envelope)
    return JsonCodec.value(response)
  }

  private static page(tabId: number, value: string | undefined): ActivePage | null {
    if (!value) return null
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return { tabId, url: value, origin: url.origin, path: url.pathname }
  }
}
