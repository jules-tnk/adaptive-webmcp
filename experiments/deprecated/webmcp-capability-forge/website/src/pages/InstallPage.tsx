import { Link } from 'react-router-dom'

import { SiteRoute } from '../app/site-route'

export function InstallPage() {
  return (
    <main className="content-page">
      <header className="page-hero install-hero">
        <p className="eyebrow">Install</p>
        <h1>Chrome Web Store release in progress.</h1>
        <p>WebMCP Capability Forge is a Chrome extension for teaching, discovering, verifying, and reusing browser workflows as WebMCP tools. The Store link will appear here after review.</p>
      </header>
      <section className="permission-section">
        <header><p className="eyebrow">Permission explanations</p><h2>Access stays tied to the product’s single purpose.</h2></header>
        <dl className="permission-list">
          <div><dt>scripting</dt><dd>Injects packaged recording and WebMCP runtime code on an enabled site.</dd></div>
          <div><dt>storage</dt><dd>Keeps sessions, capabilities, verification, and failures on your device.</dd></div>
          <div><dt>tabs</dt><dd>Coordinates the enabled tab, route checkpoints, and side panel.</dd></div>
          <div><dt>sidePanel</dt><dd>Shows teaching, review, tools, evidence, and confirmations beside the page.</dd></div>
          <div><dt>Optional site access</dt><dd>Runs only on a site after you grant that site permission.</dd></div>
        </dl>
      </section>
      <section className="install-next">
        <h2>Before installation</h2>
        <p>Read how local page data is processed and which workflows remain blocked.</p>
        <div className="inline-links"><Link to={SiteRoute.Privacy}>Read Privacy</Link><Link to={SiteRoute.Terms}>Read Terms</Link><Link to={SiteRoute.Support}>Get support</Link></div>
      </section>
    </main>
  )
}
