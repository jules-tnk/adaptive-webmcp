import {
  BridgeDirection,
  BridgeMessageType,
  FailureCode,
  type JsonObject,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import { BridgeEnvelopeCodec } from '../bridge/bridge-envelope'
import type { PageBridge } from './bootstrap-runtime'

interface PendingRequest {
  readonly resolve: (value: JsonValue) => void
  readonly timeout: ReturnType<typeof setTimeout>
}

const requestTimeoutMs = 5000

export class MainWorldPageBridge implements PageBridge {
  private readonly pending = new Map<string, PendingRequest>()

  constructor() {
    window.addEventListener('message', this.onMessage)
  }

  request(type: string, payload: JsonObject): Promise<JsonValue> {
    if (!Object.values(BridgeMessageType).includes(type as BridgeMessageType)) {
      return Promise.resolve({ ok: false, code: FailureCode.BridgeInvalid })
    }
    const requestId = crypto.randomUUID()
    const envelope = BridgeEnvelopeCodec.create({
      requestId,
      direction: BridgeDirection.PageToExtension,
      type: type as BridgeMessageType,
      payload,
    })
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId)
        resolve({ ok: false, code: FailureCode.NavigationInterrupted })
      }, requestTimeoutMs)
      this.pending.set(requestId, { resolve, timeout })
      window.postMessage(envelope, window.location.origin)
    })
  }

  dispose(): void {
    window.removeEventListener('message', this.onMessage)
    for (const request of this.pending.values()) clearTimeout(request.timeout)
    this.pending.clear()
  }

  private readonly onMessage = (event: MessageEvent<JsonValue>): void => {
    if (event.source !== window) return
    const parsed = BridgeEnvelopeCodec.parse(event.data, BridgeDirection.ExtensionToPage)
    if (!parsed.valid || parsed.value.type !== BridgeMessageType.ContentResponse) return
    const pending = this.pending.get(parsed.value.requestId)
    if (!pending) return
    clearTimeout(pending.timeout)
    this.pending.delete(parsed.value.requestId)
    pending.resolve(parsed.value.payload)
  }
}
