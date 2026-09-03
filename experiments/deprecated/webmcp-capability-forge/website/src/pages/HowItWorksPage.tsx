export function HowItWorksPage() {
  return (
    <main className="content-page">
      <header className="page-hero">
        <p className="eyebrow">How it works</p>
        <h1>Evidence first. Approval before activation.</h1>
        <p>You can teach a workflow, or an agent can explore when it cannot reuse a healthy tool. A trace becomes Hybrid when both contribute.</p>
      </header>
      <section className="process-list" aria-label="Capability lifecycle">
        <article><span>01</span><div><h2>Set the goal</h2><p>You or the agent names the workflow and its intended result.</p></div></article>
        <article><span>02</span><div><h2>Collect evidence</h2><p>A person demonstrates, an agent explores, or both contribute to one immutable trace.</p></div></article>
        <article><span>03</span><div><h2>Review the contract</h2><p>You inspect inputs, targets, steps, routes, outputs, provenance, and risk.</p></div></article>
        <article><span>04</span><div><h2>Verify honestly</h2><p>Safe workflows receive replay evidence. Consequential workflows stay guarded.</p></div></article>
        <article><span>05</span><div><h2>Reuse and repair</h2><p>The tool returns after reload and reports stale targets for reviewed replacement.</p></div></article>
      </section>
      <section className="boundary-section">
        <p className="eyebrow">Version one boundary</p>
        <h2>Current tab. Same origin. Explicit consequences.</h2>
        <p>Capability Forge supports standard page controls, open Shadow DOM, and same-origin route checkpoints. It excludes authentication, payment fields, CAPTCHAs, files, cross-origin continuation, and agent-supplied code.</p>
      </section>
    </main>
  )
}
