import { CatalogCategory, FixtureVersion } from 'webmcp-capability-forge-core'

import type { CatalogFixtureProps } from './BaselineCatalog'

export function ChangedCatalog(props: CatalogFixtureProps) {
  return (
    <div className="catalog-layout" data-fixture-state={FixtureVersion.Changed}>
      <section className="catalog-workspace" aria-label="Catalog search">
        <div className="catalog-fields">
          <label>Search catalog<input id="finder-query-v2" value={props.query} onChange={(event) => props.onQuery(event.target.value)} /></label>
          <label>Category<select id="finder-category-v2" value={props.category} onChange={(event) => props.onCategory(event.target.value as CatalogCategory)}>{Object.values(CatalogCategory).map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <button type="button" data-command="run-search-v2" onClick={props.onSearch}>Search</button>
        </div>
        <div className="catalog-results" aria-live="polite">
          {props.results.map((item) => <article key={item.id} data-discovery-result={item.id}><div><p>{item.category}</p><h3>{item.name}</h3><span>{item.description}</span></div><button type="button" data-pin-item={item.id} onClick={() => props.onShortlist(item)}>Shortlist</button></article>)}
        </div>
      </section>
      <aside className="shortlist" aria-label="Shortlist"><h3>Shortlist</h3>{props.shortlist.length === 0 ? <p>Nothing selected yet.</p> : props.shortlist.map((item) => <div key={item.id}>{item.name}</div>)}</aside>
    </div>
  )
}
