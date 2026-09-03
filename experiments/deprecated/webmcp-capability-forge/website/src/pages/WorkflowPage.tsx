import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  CatalogCategory,
  FixtureVersion,
  type CatalogItem,
} from 'webmcp-capability-forge-core'

import { SiteRoute } from '../app/site-route'
import { BaselineCatalog } from '../fixtures/BaselineCatalog'
import { CatalogStore } from '../fixtures/catalog-store'
import { ChangedCatalog } from '../fixtures/ChangedCatalog'

export function WorkflowPage() {
  const store = useMemo(() => new CatalogStore(), [])
  const [version, setVersion] = useState(FixtureVersion.Baseline)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(CatalogCategory.All)
  const [results, setResults] = useState<readonly CatalogItem[]>([])
  const [shortlist, setShortlist] = useState<readonly CatalogItem[]>([])
  const search = () => setResults(store.search(query, category))
  const add = (item: CatalogItem) => setShortlist((current) => current.some((entry) => entry.id === item.id) ? current : [...current, item])
  const props = { query, category, results, shortlist, onQuery: setQuery, onCategory: setCategory, onSearch: search, onShortlist: add }

  return (
    <main>
      <section className="lab-hero">
        <div><p className="eyebrow light">Workflow fixture</p><h1>Find and shortlist one item.</h1><p>Human labels stay constant while the machine selectors change.</p></div>
        <div className="fixture-controls" aria-label="Fixture controls">
          <button type="button" className={version === FixtureVersion.Baseline ? 'active' : ''} onClick={() => setVersion(FixtureVersion.Baseline)}>Baseline DOM</button>
          <button type="button" className={version === FixtureVersion.Changed ? 'active' : ''} onClick={() => setVersion(FixtureVersion.Changed)}>Changed DOM</button>
          <button type="button" onClick={() => { setQuery(''); setCategory(CatalogCategory.All); setResults([]); setShortlist([]) }}>Reset lab</button>
        </div>
      </section>
      <section className="lab-workspace">
        {version === FixtureVersion.Baseline ? <BaselineCatalog {...props} /> : <ChangedCatalog {...props} />}
      </section>
      <section className="route-tests"><div><p className="eyebrow">Navigation scenarios</p><h2>Test route continuation.</h2></div><div className="inline-links"><Link to={SiteRoute.LabResults}>Open with SPA navigation</Link><a href={SiteRoute.LabResults}>Open with full-document navigation</a><Link to={SiteRoute.LabEvidence}>Read evidence boundaries</Link></div></section>
    </main>
  )
}
