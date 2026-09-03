import { ExternalUrl } from '../app/site-route'

export function SupportPage() {
  return (
    <main className="content-page">
      <header className="page-hero">
        <p className="eyebrow">Support</p>
        <h1>Describe the page, goal, and failed step.</h1>
        <p>Support is provided by email during the pre-release period. There is no account or contact form.</p>
      </header>
      <section className="support-grid">
        <div>
          <h2>Before contacting support</h2>
          <ol><li>Confirm Chrome and WebMCP support are enabled.</li><li>Confirm Capability Forge is enabled for the current site.</li><li>Open Evidence and note the failure code and step number.</li><li>Remove credentials, personal communications, and sensitive page content.</li></ol>
        </div>
        <div className="support-contact">
          <p className="eyebrow">Email</p>
          <a href={ExternalUrl.SupportEmail}>julestnk.dev@gmail.com</a>
          <p>Include the extension version, Chrome version, website origin, workflow goal, and bounded failure code.</p>
        </div>
      </section>
    </main>
  )
}
