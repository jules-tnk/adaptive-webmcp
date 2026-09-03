import { beforeEach, describe, expect, it } from 'vitest'

import { FailureCode, SelectorKind, SelectorRanker, SemanticRole } from 'webmcp-capability-forge-core'

import { SemanticInventory } from './semantic-inventory'
import { SensitiveTargetPolicy, SensitiveTargetReason } from './sensitive-target-policy'

describe('SemanticInventory', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <label for="query">Search catalog</label>
      <input id="query" name="query" />
      <button aria-label="Search">Go</button>
      <button hidden>Hidden action</button>
      <input type="password" aria-label="Password" />
      <input autocomplete="cc-number" aria-label="Card number" />
      <div id="shadow-host"></div>
    `
    const host = document.querySelector('#shadow-host')
    if (!(host instanceof HTMLElement)) throw new Error('Shadow host missing in test fixture.')
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = '<button aria-label="Run report">Run</button>'
  })

  it('lists visible standard and open-shadow controls while excluding sensitive targets', () => {
    const inspection = SemanticInventory.inspect(document)
    const names = inspection.targets.map((target) => target.name)

    expect(names).toContain('Search catalog')
    expect(names).toContain('Search')
    expect(names).toContain('Run report')
    expect(names).not.toContain('Hidden action')
    expect(names).not.toContain('Password')
    expect(names).not.toContain('Card number')
    expect(inspection.targets.find((target) => target.name === 'Search')?.role).toBe(
      SemanticRole.Button,
    )
  })

  it('invalidates handles after a newer page inspection', () => {
    const first = SemanticInventory.inspect(document)
    const handle = first.targets[0]?.handle
    if (!handle) throw new Error('Expected at least one target handle.')

    expect(SemanticInventory.resolve(document, handle).valid).toBe(true)
    SemanticInventory.inspect(document)
    const stale = SemanticInventory.resolve(document, handle)

    expect(stale.valid).toBe(false)
    if (!stale.valid) expect(stale.failure).toBe(FailureCode.StaleRevision)
  })

  it('does not treat a generic tag as an associated-label selector when the control has no id', () => {
    document.body.innerHTML = '<label>Search catalog<input name="catalog-query"></label>'

    const search = SemanticInventory.inspect(document).targets.find((target) => target.name === 'Search catalog')

    expect(search?.strategy.candidates[0]?.kind).toBe(SelectorKind.StableName)
    expect(search?.strategy.candidates.some((candidate) => candidate.selector === 'input')).toBe(false)
  })

  it('creates a unique structural fallback for an otherwise unidentifiable link', () => {
    document.body.innerHTML = '<main><div><a href="/same">SPA</a><a href="/same">Full document</a></div></main>'

    const target = SemanticInventory.inspect(document).targets.find(
      (candidate) => candidate.name === 'Full document',
    )
    if (!target) throw new Error('Full-document link target missing.')
    const selected = SelectorRanker.select(target.strategy.candidates)

    expect(selected.valid).toBe(true)
    if (!selected.valid) return
    expect(selected.value.kind).toBe(SelectorKind.Structural)
    expect(document.querySelectorAll(selected.value.selector)).toHaveLength(1)
  })
})

describe('SensitiveTargetPolicy', () => {
  it('blocks credentials, payment data, authentication codes, files, and hidden inputs', () => {
    const fixtures = [
      ['<input type="password">', SensitiveTargetReason.Credential],
      ['<input autocomplete="cc-number">', SensitiveTargetReason.Payment],
      ['<input autocomplete="one-time-code">', SensitiveTargetReason.AuthenticationCode],
      ['<input type="file">', SensitiveTargetReason.File],
      ['<input type="hidden">', SensitiveTargetReason.Hidden],
    ] as const

    for (const [markup, reason] of fixtures) {
      document.body.innerHTML = markup
      const input = document.querySelector('input')
      if (!(input instanceof HTMLInputElement)) throw new Error('Input fixture missing.')
      expect(SensitiveTargetPolicy.classify(input)).toEqual({ blocked: true, reason })
    }
  })
})
