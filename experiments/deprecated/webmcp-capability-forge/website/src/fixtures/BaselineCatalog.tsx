import { CatalogCategory, FixtureVersion, type CatalogItem } from 'webmcp-capability-forge-core'

export interface CatalogFixtureProps {
  readonly query: string
  readonly category: CatalogCategory
  readonly results: readonly CatalogItem[]
  readonly shortlist: readonly CatalogItem[]
  readonly onQuery: (value: string) => void
  readonly onCategory: (value: CatalogCategory) => void
  readonly onSearch: () => void
  readonly onShortlist: (item: CatalogItem) => void
}

export function BaselineCatalog(props: CatalogFixtureProps) {
  return (
    <div className="catalog-layout" data-lab-version={FixtureVersion.Baseline}>
      <section className="catalog-workspace" aria-label="Catalog search">
        <div className="catalog-fields">
          <label>Search catalog<input name="catalog-query" value={props.query} onChange={(event) => props.onQuery(event.target.value)} /></label>
          <label>Category<select name="catalog-category" value={props.category} onChange={(event) => props.onCategory(event.target.value as CatalogCategory)}>{Object.values(CatalogCategory).map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <button type="button" data-search-submit onClick={props.onSearch}>Search</button>
        </div>
        <div className="catalog-results" aria-live="polite">
          {props.results.map((item) => <article key={item.id} data-result-card data-item-id={item.id}><div><p>{item.category}</p><h3>{item.name}</h3><span>{item.description}</span></div><button type="button" data-shortlist onClick={() => props.onShortlist(item)}>Shortlist</button></article>)}
        </div>
      </section>
      <aside className="shortlist" aria-label="Shortlist"><h3>Shortlist</h3>{props.shortlist.length === 0 ? <p>Nothing selected yet.</p> : props.shortlist.map((item) => <div key={item.id}>{item.name}</div>)}</aside>
    </div>
  )
}
