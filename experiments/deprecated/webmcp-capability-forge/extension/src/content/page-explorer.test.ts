import { beforeEach, describe, expect, it } from 'vitest'

import {
  FailureCode,
  InteractionEffect,
  RiskPhase,
  WorkflowAction,
} from 'webmcp-capability-forge-core'

import { PageExplorer } from './page-explorer'
import { PageObserver } from './page-observer'

describe('PageExplorer', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button aria-label="Next">Next</button>'
  })

  it('requires confirmation before agent navigation and then performs the approved click', async () => {
    let clicks = 0
    const button = document.querySelector('button')
    if (!(button instanceof HTMLButtonElement)) throw new Error('Button fixture missing.')
    button.addEventListener('click', () => { clicks += 1 })
    const explorer = new PageExplorer({ now: () => 1200, createId: () => 'event-1' })
    const handle = explorer.inspect(document).targets[0]?.handle
    if (!handle) throw new Error('Target handle missing.')

    const blocked = await explorer.interact({
      documentValue: document,
      handle,
      action: WorkflowAction.Click,
      effect: InteractionEffect.Navigation,
      phase: RiskPhase.Learning,
      confirmed: false,
      origin: 'https://shop.example',
      path: '/catalog',
    })
    expect(blocked.ok).toBe(false)
    expect(blocked.failure?.code).toBe(FailureCode.RiskConfirmationRequired)
    expect(clicks).toBe(0)

    const approved = await explorer.interact({
      documentValue: document,
      handle,
      action: WorkflowAction.Click,
      effect: InteractionEffect.Navigation,
      phase: RiskPhase.Learning,
      confirmed: true,
      origin: 'https://shop.example',
      path: '/catalog',
    })
    expect(approved.ok).toBe(true)
    expect(clicks).toBe(1)
  })

  it('rejects a handle from an older inspection', async () => {
    const explorer = new PageExplorer({ now: () => 1200, createId: () => 'event-1' })
    const handle = explorer.inspect(document).targets[0]?.handle
    if (!handle) throw new Error('Target handle missing.')
    explorer.inspect(document)

    const result = await explorer.interact({
      documentValue: document,
      handle,
      action: WorkflowAction.Click,
      phase: RiskPhase.Execution,
      confirmed: true,
      origin: 'https://shop.example',
      path: '/catalog',
    })

    expect(result.ok).toBe(false)
    expect(result.failure?.code).toBe(FailureCode.StaleRevision)
  })
})

describe('PageObserver', () => {
  it('truncates visible observations to thirty-two kilobytes', () => {
    document.body.textContent = 'a'.repeat(40_000)

    const observation = PageObserver.capture(document.body)

    expect(observation.truncated).toBe(true)
    expect(new TextEncoder().encode(observation.text ?? '').byteLength).toBeLessThanOrEqual(32_768)
  })
})
