import {
  CatalogCategory,
  type CatalogItem,
} from 'webmcp-capability-forge-core'

const items: readonly CatalogItem[] = [
  { id: 'field-notebook', name: 'Field Notebook', category: CatalogCategory.Office, description: 'A ruled notebook for project notes.' },
  { id: 'cedar-lamp', name: 'Cedar Lamp', category: CatalogCategory.Home, description: 'A warm desk lamp with a cedar base.' },
  { id: 'trail-flask', name: 'Trail Flask', category: CatalogCategory.Outdoors, description: 'An insulated flask for long walks.' },
  { id: 'signal-radio', name: 'Signal Radio', category: CatalogCategory.Electronics, description: 'A compact rechargeable radio.' },
]

export class CatalogStore {
  search(query: string, category: CatalogCategory): readonly CatalogItem[] {
    const normalized = query.trim().toLowerCase()
    return items.filter(
      (item) =>
        (category === CatalogCategory.All || item.category === category) &&
        (normalized.length === 0 ||
          item.name.toLowerCase().includes(normalized) ||
          item.description.toLowerCase().includes(normalized)),
    )
  }
}
