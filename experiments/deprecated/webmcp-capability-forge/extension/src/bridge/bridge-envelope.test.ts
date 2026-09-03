import { describe, expect, it } from 'vitest'

import {
  BridgeDirection,
  BridgeMessageType,
  FailureCode,
  type JsonObject,
} from 'webmcp-capability-forge-core'

import { BridgeEnvelopeCodec } from './bridge-envelope'
import { BridgeReplayGuard } from './bridge-replay-guard'

describe('BridgeEnvelopeCodec', () => {
  it('round-trips a valid site-enable envelope', () => {
    const envelope = BridgeEnvelopeCodec.create({
      requestId: 'request-1',
      direction: BridgeDirection.UiToBackground,
      type: BridgeMessageType.SiteEnable,
      payload: { url: 'https://shop.example/catalog', tabId: 12 },
    })

    const parsed = BridgeEnvelopeCodec.parse(envelope, BridgeDirection.UiToBackground)

    expect(parsed.valid).toBe(true)
  })

  it.each([BridgeMessageType.SiteStatus, BridgeMessageType.SiteDisable])(
    'round-trips a valid %s page payload',
    (type) => {
      const envelope = BridgeEnvelopeCodec.create({
        requestId: `request-${type}`,
        direction: BridgeDirection.UiToBackground,
        type,
        payload: { url: 'https://www.youtube.com/@TheGreatReview/videos', tabId: 12 },
      })

      const parsed = BridgeEnvelopeCodec.parse(envelope, BridgeDirection.UiToBackground)

      expect(parsed.valid).toBe(true)
    },
  )

  it.each([
    ['session.append', { tabId: 12, event: {
      id: 'event-1',
      source: 'human',
      action: 'click',
      target: {
        role: 'button',
        name: 'Search',
        candidates: [{ kind: 'accessible_role', selector: '[aria-label="Search"]', score: 100, uniqueAtRecording: true }],
      },
      origin: 'https://shop.example',
      path: '/catalog',
      timestamp: 1000,
    } }],
    ['session.stop', { tabId: 12 }],
  ])('round-trips a valid %s payload', (type, payload) => {
    const envelope = BridgeEnvelopeCodec.create({
      requestId: `request-${type}`,
      direction: BridgeDirection.UiToBackground,
      type: type as BridgeMessageType,
      payload,
    })

    expect(BridgeEnvelopeCodec.parse(envelope, BridgeDirection.UiToBackground).valid).toBe(true)
  })

  it('rejects wrong protocol versions and directions', () => {
    const invalid: JsonObject = {
      protocol: 'webmcp-capability-forge-bridge',
      version: 2,
      requestId: 'request-1',
      direction: BridgeDirection.PageToExtension,
      type: BridgeMessageType.SiteEnable,
      payload: { url: 'https://shop.example', tabId: 12 },
    }

    expect(BridgeEnvelopeCodec.parse(invalid, BridgeDirection.UiToBackground).valid).toBe(false)
  })

  it('rejects a payload that does not match the message type', () => {
    const invalid: JsonObject = {
      protocol: 'webmcp-capability-forge-bridge',
      version: 1,
      requestId: 'request-1',
      direction: BridgeDirection.UiToBackground,
      type: BridgeMessageType.SiteEnable,
      payload: { url: 42, tabId: 'wrong' },
    }

    expect(BridgeEnvelopeCodec.parse(invalid, BridgeDirection.UiToBackground).valid).toBe(false)
  })

  it('rejects a duplicate request identifier', () => {
    const guard = new BridgeReplayGuard()
    const envelope = BridgeEnvelopeCodec.create({
      requestId: 'request-1',
      direction: BridgeDirection.UiToBackground,
      type: BridgeMessageType.SiteStatus,
      payload: { url: 'https://shop.example/catalog' },
    })

    expect(guard.accept(envelope).valid).toBe(true)
    const duplicate = guard.accept(envelope)
    expect(duplicate.valid).toBe(false)
    if (!duplicate.valid) expect(duplicate.failure).toBe(FailureCode.BridgeReplay)
  })
})
