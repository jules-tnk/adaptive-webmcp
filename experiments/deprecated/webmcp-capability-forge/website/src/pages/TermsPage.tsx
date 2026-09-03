import { ExternalUrl } from '../app/site-route'

export function TermsPage() {
  return (
    <main className="legal-page">
      <header className="legal-hero"><p className="eyebrow">Terms of Service</p><h1>Use Capability Forge with review and responsibility.</h1><p>Effective August 29, 2026</p></header>
      <div className="legal-layout">
        <aside aria-label="Terms summary">
          <p><strong>Publisher</strong><br />Kibalo Jules Tinaka</p>
          <p><strong>Governing law</strong><br />Kingdom of Morocco</p>
          <p><strong>Contact</strong><br /><a href={ExternalUrl.SupportEmail}>julestnk.dev@gmail.com</a></p>
        </aside>
        <article className="legal-copy">
          <section><h2>1. Acceptance</h2><p>By installing or using WebMCP Capability Forge, you agree to these Terms. If you do not agree, do not install or use the product.</p></section>
          <section><h2>2. Eligibility</h2><p>You must have legal capacity to accept these Terms. The product is not directed to children under 13. A parent or guardian must authorize use where applicable law requires it.</p></section>
          <section><h2>3. Product purpose</h2><p>Capability Forge helps a person and an AI agent record, discover, review, verify, store, reuse, and repair browser workflows as WebMCP tools. The product does not guarantee that a workflow is correct, lawful, safe for every context, or compatible with future website versions.</p></section>
          <section><h2>4. Your responsibility</h2><p>You remain responsible for the sites you enable, the goals you provide, the capability contracts you approve, the inputs you supply, and the effects of agent or tool execution. Review each consequential action before confirming it.</p></section>
          <section><h2>5. Acceptable use</h2><p>Do not use the product to violate law, third-party rights, access restrictions, security controls, website terms, or user consent. Do not use it for fraud, harassment, malware, credential theft, unauthorized access, deceptive communication, or prohibited automated activity.</p></section>
          <section><h2>6. Sensitive and consequential actions</h2><p>The product attempts to block sensitive targets and require confirmation for consequential actions. Those controls reduce risk but do not replace your judgment or obligations.</p></section>
          <section><h2>7. Third-party websites and agents</h2><p>Third-party websites, browsers, AI agents, and services are controlled by their providers. Their content, availability, policies, and behavior may change without notice. The publisher does not endorse or control them.</p></section>
          <section><h2>8. Availability and changes</h2><p>The product may change, pause, or discontinue. Features described during pre-release may remain unavailable until a compatible Chrome and WebMCP environment exists.</p></section>
          <section id="open-source"><h2>9. Intellectual property and open source</h2><p>WebMCP Capability Forge branding, website copy, and release assets remain protected by applicable law. Source code identified as MIT licensed may be used under the MIT License included with the repository. The public source repository is still being prepared.</p></section>
          <section><h2>10. Disclaimer</h2><p>To the extent permitted by law, the product is provided “as is” and “as available,” without warranties of merchantability, fitness for a particular purpose, non-infringement, uninterrupted operation, or compatibility with a specific website or agent.</p></section>
          <section><h2>11. Limitation of liability</h2><p>To the extent permitted by law, Kibalo Jules Tinaka is not liable for indirect, incidental, special, consequential, or punitive loss arising from use of the product, learned workflows, third-party websites, agents, data loss, or service interruption. Mandatory rights and liabilities that cannot be excluded remain unaffected.</p></section>
          <section><h2>12. Suspension and termination</h2><p>You may stop using the product at any time. The publisher may suspend distribution or support when required for law, security, policy compliance, abuse prevention, or product discontinuation.</p></section>
          <section><h2>13. Governing law</h2><p>These Terms are governed by the laws of the Kingdom of Morocco. Courts with competent jurisdiction in Morocco may hear disputes, unless mandatory consumer law gives you a different governing law or forum.</p></section>
          <section><h2>14. Changes and contact</h2><p>Updated Terms will appear on this page with a new effective date. Questions can be sent to <a href={ExternalUrl.SupportEmail}>julestnk.dev@gmail.com</a>.</p></section>
        </article>
      </div>
    </main>
  )
}
