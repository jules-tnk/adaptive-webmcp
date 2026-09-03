import { Link } from 'react-router-dom'

import { SiteRoute } from '../app/site-route'
import { InstallDisclosure } from '../components/InstallDisclosure'

export function HomePage() {
  return (
    <main>
      <section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow light">Teach once. Reuse with an agent.</p>
          <h1>Turn browser work into reviewed WebMCP tools.</h1>
          <p className="hero-summary">
            Teach a workflow yourself, or let an agent discover one while working on its task.
            Capability Forge records each source, asks you to review the contract, and verifies safe replays.
          </p>
          <div className="hero-actions">
            <Link className="button-primary" to={SiteRoute.Install}>Prepare to install</Link>
            <Link className="button-dark-secondary" to={SiteRoute.HowItWorks}>See how it works</Link>
          </div>
        </div>
        <div className="trace-visual" aria-label="Human and agent evidence become one verified tool">
          <div className="trace-source"><span>Human</span><strong>Demonstrate</strong></div>
          <div className="trace-line" aria-hidden="true"><span /><span /><span /></div>
          <div className="trace-source"><span>Agent</span><strong>Explore</strong></div>
          <div className="trace-result"><span>Verified capability</span><strong>Reusable WebMCP tool</strong></div>
        </div>
      </section>

      <section className="editorial-band mode-band">
        <header className="section-heading">
          <p className="eyebrow">Three evidence patterns</p>
          <h2>One capability lifecycle.</h2>
        </header>
        <div className="mode-list">
          <article><span>Human</span><h3>Teach a workflow</h3><p>You perform the task once. The extension records bounded, non-sensitive evidence.</p></article>
          <article><span>Agent</span><h3>Autonomous discovery</h3><p>An agent calls capability_forge when no healthy tool fits its current task.</p></article>
          <article><span>Mixed</span><h3>Shared trace</h3><p>A trace becomes Hybrid when both you and the agent contribute recorded actions.</p></article>
        </div>
      </section>

      <section className="dark-proof-band">
        <div><p className="eyebrow light">Human-supervised by design</p><h2>The agent cannot approve its own tool.</h2></div>
        <ul className="proof-list">
          <li>Declarative actions instead of generated JavaScript</li>
          <li>Exact-origin storage on your device</li>
          <li>Replay evidence labelled by verification strength</li>
          <li>Reviewed repair without replacing working history</li>
        </ul>
      </section>

      <section className="editorial-band install-band">
        <div>
          <p className="eyebrow">Pre-release</p>
          <h2>Chrome Web Store release in progress.</h2>
          <p>The public listing is being prepared. No email, account, analytics, or waiting-list signup is required.</p>
        </div>
        <InstallDisclosure />
      </section>
    </main>
  )
}
