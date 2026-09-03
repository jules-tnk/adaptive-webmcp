import { ExternalUrl } from '../app/site-route'

export function PrivacyPage() {
  return (
    <main className="legal-page">
      <header className="legal-hero"><p className="eyebrow">Privacy Policy</p><h1>Local workflow processing, described plainly.</h1><p>Effective August 29, 2026</p></header>
      <div className="legal-layout">
        <aside aria-label="Policy summary">
          <p><strong>Publisher</strong><br />Kibalo Jules Tinaka</p>
          <p><strong>Contact</strong><br /><a href={ExternalUrl.SupportEmail}>julestnk.dev@gmail.com</a></p>
          <p><strong>Release model</strong><br />Local extension storage. No telemetry.</p>
        </aside>
        <article className="legal-copy">
          <section><h2>1. Scope</h2><p>This policy covers the WebMCP Capability Forge Chrome extension and its official website. Kibalo Jules Tinaka publishes the product as an individual from Morocco.</p></section>
          <section><h2>2. Information processed by the extension</h2><p>To record, inspect, verify, and replay workflows, the extension processes the enabled page’s origin and path, visible-control metadata, bounded page observations, user and agent interactions, and non-sensitive workflow inputs.</p><p>It also processes capability definitions, selector evidence, revisions, verification results, health state, and bounded failure summaries.</p></section>
          <section><h2>3. Information blocked</h2><p>The extension is designed to block password fields, payment fields, authentication codes, file inputs, hidden inputs, and other targets classified as sensitive. It does not intentionally store cookies, complete page snapshots, complete conversations, or browser history.</p></section>
          <section><h2>4. Local storage and retention</h2><p>Extension information is stored in <code>chrome.storage.local</code> on the user’s device. It remains until the user deletes a session or tool, clears extension data, or removes the extension. Export occurs only after a direct user action.</p></section>
          <section><h2>5. Transmission, sharing, and sale</h2><p>The extension sends no workflow data or telemetry to Kibalo Jules Tinaka. The publisher does not sell extension data, use it for advertising, or share it with data brokers. The first release has no backend, account, cloud sync, or remote model API.</p></section>
          <section><h2>6. Official website</h2><p>The website uses no analytics, advertising, tracking cookies, accounts, telemetry, contact forms, or mailing lists. It is hosted with classic Google Firebase Hosting; Firebase Analytics and every other Firebase product are disabled.</p><p>Google Firebase Hosting may process standard network request and security logs to deliver and protect the site. Firebase’s current retention, subprocessors, and terms must be reconfirmed before public release.</p></section>
          <section><h2>7. Security</h2><p>The extension uses optional site permissions, exact-origin capability scope, bounded observations, strict schemas, packaged executable code, and direct review for new or replacement tools. No security measure can guarantee that a changing third-party site will remain compatible.</p></section>
          <section><h2>8. Children</h2><p>The product is not directed to children under 13. The publisher does not knowingly collect children’s personal information through the website or a remote service.</p></section>
          <section><h2>9. Chrome Web Store Limited Use</h2><p>Information received through Chrome APIs is used only to provide and improve the extension’s disclosed single purpose. It is not used for personalized advertising, credit decisions, sale, or unrelated human review. The extension is intended to comply with the Chrome Web Store User Data Policy, including Limited Use requirements.</p></section>
          <section><h2>10. Your choices and contact</h2><p>Users can disable site access, pause or delete learned tools, clear local extension storage, export approved definitions, or uninstall the extension. Questions about this policy can be sent to <a href={ExternalUrl.SupportEmail}>julestnk.dev@gmail.com</a>.</p></section>
          <section><h2>11. Changes</h2><p>Material changes will be published on this page and reflected in the Chrome Web Store disclosures before changed data handling begins.</p></section>
        </article>
      </div>
    </main>
  )
}
