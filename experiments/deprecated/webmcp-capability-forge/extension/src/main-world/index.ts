import { BootstrapRuntime } from './bootstrap-runtime'
import { ModelContextAdapter } from './model-context-adapter'
import { LearnedToolRuntime } from './learned-tool-runtime'
import { MainWorldPageBridge } from './page-bridge'
import {
  BootstrapOperation,
  BridgeDirection,
  BridgeMessageType,
  JsonTypes,
  SchemaCatalog,
  type JsonValue,
} from 'webmcp-capability-forge-core'
import { BridgeEnvelopeCodec } from '../bridge/bridge-envelope'

const context = ModelContextAdapter.get(document)
if (context) {
  const runtime = new BootstrapRuntime()
  const bridge = new MainWorldPageBridge()
  const learnedTools = new LearnedToolRuntime(context, bridge)
  void runtime.install(context, bridge).then(async () => {
    const protocol = await bridge.request(BridgeMessageType.ProtocolInspect, {
      operation: BootstrapOperation.Inspect,
    })
    if (JsonTypes.isObject(protocol) && protocol.session !== undefined) {
      const parsed = SchemaCatalog.parseSession(protocol.session)
      if (parsed.valid) await runtime.sync({ session: parsed.value })
    }
    if (JsonTypes.isObject(protocol) && Array.isArray(protocol.tools)) {
      await learnedTools.sync(RuntimeTools.parse(protocol.tools), {
        origin: window.location.origin,
        path: window.location.pathname,
      })
    }
  })
  const onRuntimeMessage = (event: MessageEvent<JsonValue>): void => {
    if (event.source !== window) return
    const parsed = BridgeEnvelopeCodec.parse(event.data, BridgeDirection.ExtensionToPage)
    if (!parsed.valid || parsed.value.type !== BridgeMessageType.RuntimeSync) return
    if (!JsonTypes.isObject(parsed.value.payload)) return
    const session = parsed.value.payload.session
    if (session !== undefined) {
      const validated = SchemaCatalog.parseSession(session)
      if (validated.valid) void runtime.sync({ session: validated.value })
    }
    if (Array.isArray(parsed.value.payload.tools)) {
      void learnedTools.sync(RuntimeTools.parse(parsed.value.payload.tools), {
        origin: window.location.origin,
        path: window.location.pathname,
      })
    }
  }
  window.addEventListener('message', onRuntimeMessage)
  window.addEventListener('pagehide', () => {
    window.removeEventListener('message', onRuntimeMessage)
    runtime.dispose()
    learnedTools.dispose()
    bridge.dispose()
  }, { once: true })
}

class RuntimeTools {
  static parse(values: readonly JsonValue[]) {
    return values.flatMap((value) => {
      const parsed = SchemaCatalog.parseCapability(value)
      return parsed.valid ? [parsed.value] : []
    })
  }
}
