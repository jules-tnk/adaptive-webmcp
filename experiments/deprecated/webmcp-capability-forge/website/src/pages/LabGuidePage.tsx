import { Link } from 'react-router-dom'

import { SiteRoute } from '../app/site-route'

export function LabGuidePage() {
  return (
    <main className="content-page lab-guide">
      <header className="page-hero">
        <p className="eyebrow">Deterministic lab</p>
        <h1>Use the lab to test Capability Forge before using it on a live website.</h1>
        <p>The lab gives judges and developers one repeatable place to teach, explore, review, verify, reuse, break, and repair a workflow.</p>
        <Link className="button-primary lab-hero-cta" to={SiteRoute.LabWorkflow}>Open the workflow lab</Link>
      </header>
      <section className="process-list" aria-label="Lab walkthrough">
        <article><span>01</span><div><h2>Enable this website</h2><p>Click the extension icon to open Capability Forge, then use Site to enable access for this origin.</p></div></article>
        <article><span>02</span><div><h2>Teach or give an agent a task</h2><p>Use Teach a workflow for a human demonstration. An agent starts its own exploration through capability_forge when no healthy tool fits its task.</p></div></article>
        <article><span>03</span><div><h2>Use Baseline DOM</h2><p>Search for notebook in Office and shortlist Field Notebook.</p></div></article>
        <article><span>04</span><div><h2>Review and verify</h2><p>Check the scope, steps, Human or Agent sources, risk, and replay evidence before activation.</p></div></article>
        <article><span>05</span><div><h2>Switch to Changed DOM</h2><p>Run the old tool, observe the stale target, and approve a repaired revision.</p></div></article>
      </section>
      <Link className="button-primary lab-cta" to={SiteRoute.LabWorkflow}>Open the workflow lab</Link>
    </main>
  )
}
