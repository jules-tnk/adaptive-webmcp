import type { BridgeDirection, BridgeEnvelope, JsonValue } from 'webmcp-capability-forge-core'

import { BridgeEnvelopeCodec } from './bridge-envelope'

export interface WindowBridgeListener {
  receive(envelope: BridgeEnvelope): void
}

export class WindowBridge {
  private readonly direction: BridgeDirection
  private readonly listener: WindowBridgeListener
  private readonly onMessage: (event: MessageEvent<JsonValue>) => void

  constructor(direction: BridgeDirection, listener: WindowBridgeListener) {
    this.direction = direction
    this.listener = listener
    this.onMessage = (event) => {
      if (event.source !== window) return
      const parsed = BridgeEnvelopeCodec.parse(event.data, this.direction)
      if (parsed.valid) this.listener.receive(parsed.value)
    }
  }

  start(): void {
    window.addEventListener('message', this.onMessage)
  }

  send(envelope: BridgeEnvelope): void {
    window.postMessage(envelope, window.location.origin)
  }

  dispose(): void {
    window.removeEventListener('message', this.onMessage)
  }
}
