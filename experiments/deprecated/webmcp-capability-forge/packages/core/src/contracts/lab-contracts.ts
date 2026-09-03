export enum CatalogCategory {
  All = 'all',
  Home = 'home',
  Office = 'office',
  Outdoors = 'outdoors',
  Electronics = 'electronics',
}

export enum FixtureVersion {
  Baseline = 'baseline',
  Changed = 'changed',
}

export interface CatalogItem {
  readonly id: string
  readonly name: string
  readonly category: CatalogCategory
  readonly description: string
}
