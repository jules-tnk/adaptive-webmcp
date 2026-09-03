import { describe, expect, it } from 'vitest'

import {
  CatalogCategory,
  JsonTypes,
  type JsonObject,
} from 'webmcp-capability-forge-core'

import { LegacyToolPackImporter } from './legacy-toolpack-importer'

const validPack: JsonObject = {
  format: 'adaptive-webmcp-toolpack',
  version: 1,
  exportedAt: '2026-08-29T00:00:00.000Z',
  origin: 'https://shop.example',
  tools: [
    {
      format: 'adaptive-webmcp-tool',
      version: 1,
      name: 'find_item',
      description: 'Find one catalog item.',
      scope: { origin: 'https://shop.example', pathMatch: '/catalog*' },
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' }, category: { type: 'string' } },
        required: ['query', 'category'],
        additionalProperties: false,
      },
      classification: 'read',
      workflow: [
        { action: 'fill', selector: '[name="query"]', value: { source: 'input', name: 'query' } },
        { action: 'fill', selector: '[name="category"]', value: { source: 'input', name: 'category' } },
        { action: 'click', selector: '[data-search]' },
        { action: 'waitFor', selector: '[data-result]', timeoutMs: 1000 },
        { action: 'extract', selector: '[data-result]', fields: [{ name: 'text', source: 'text' }], saveAs: 'items' },
      ],
    },
  ],
}

describe('LegacyToolPackImporter', () => {
  it('converts a safe exact-origin legacy pack atomically', () => {
    const result = LegacyToolPackImporter.convert(validPack, {
      origin: 'https://shop.example',
      path: '/catalog',
    })

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]?.scope.pathPatterns).toEqual(['/catalog*'])
      expect(result.value[0]?.inputSchema.properties.category?.enum).toBeUndefined()
      expect(CatalogCategory.Office).toBe('office')
    }
  })

  it('rejects origin mismatch and unsafe legacy selectors', () => {
    const wrongOrigin = { ...validPack, origin: 'https://other.example' }
    expect(
      LegacyToolPackImporter.convert(wrongOrigin, {
        origin: 'https://shop.example',
        path: '/catalog',
      }).valid,
    ).toBe(false)

    const unsafe = JSON.parse(
      JSON.stringify(validPack).replace('[name=\\"query\\"]', 'input[type=\\"password\\"]'),
    ) as JsonObject
    expect(
      LegacyToolPackImporter.convert(unsafe, {
        origin: 'https://shop.example',
        path: '/catalog',
      }).valid,
    ).toBe(false)
  })

  it('accepts 250 legacy steps and rejects 251', () => {
    const baseTool = Array.isArray(validPack.tools) && JsonTypes.isObject(validPack.tools[0])
      ? validPack.tools[0]
      : null
    if (!baseTool) throw new Error('Legacy tool fixture missing.')
    const workflow = Array.from({ length: 250 }, (_, index) => ({
      action: 'click',
      selector: `[data-step="${index}"]`,
    })) as JsonObject[]
    const accepted: JsonObject = { ...validPack, tools: [{ ...baseTool, workflow }] }
    const rejected: JsonObject = {
      ...validPack,
      tools: [{
        ...baseTool,
        workflow: [...workflow, { action: 'click', selector: '[data-step="250"]' }],
      }],
    }

    expect(LegacyToolPackImporter.convert(accepted, {
      origin: 'https://shop.example', path: '/catalog',
    }).valid).toBe(true)
    expect(LegacyToolPackImporter.convert(rejected, {
      origin: 'https://shop.example', path: '/catalog',
    }).valid).toBe(false)
  })
})
