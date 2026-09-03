import { Link } from 'react-router-dom'

import { SiteRoute } from '../app/site-route'

export function RouteResultPage() {
  return <main className="content-page"><header className="page-hero"><p className="eyebrow">Route checkpoint reached</p><h1>The same-origin result page is active.</h1><p>Capability Forge can validate this path, restore its packaged runtime, and resume a saved continuation.</p></header><Link className="button-primary" to={SiteRoute.LabWorkflow}>Return to workflow</Link></main>
}
