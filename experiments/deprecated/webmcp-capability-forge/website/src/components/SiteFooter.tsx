import { Link } from 'react-router-dom'

import { ExternalUrl, SiteRoute } from '../app/site-route'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <p className="footer-brand">WebMCP Capability Forge</p>
        <p className="footer-note">Published by Kibalo Jules Tinaka from Morocco.</p>
      </div>
      <nav aria-label="Legal and support">
        <Link to={SiteRoute.Privacy}>Privacy</Link>
        <Link to={SiteRoute.Terms}>Terms</Link>
        <Link to={SiteRoute.Support}>Support</Link>
        <a href={`${SiteRoute.Terms}#open-source`}>MIT license</a>
      </nav>
      <div className="footer-release">
        <p>Source repository release in progress</p>
        <a href={ExternalUrl.SupportEmail}>julestnk.dev@gmail.com</a>
      </div>
    </footer>
  )
}
