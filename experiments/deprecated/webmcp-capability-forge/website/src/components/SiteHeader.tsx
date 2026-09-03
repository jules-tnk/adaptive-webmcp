import { Link, NavLink } from 'react-router-dom'

import { SiteRoute } from '../app/site-route'

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" to={SiteRoute.Home} aria-label="WebMCP Capability Forge home">
        <span className="brand-dot" aria-hidden="true" />
        <span>WebMCP Capability Forge</span>
      </Link>
      <nav className="primary-nav" aria-label="Primary navigation">
        <NavLink to={SiteRoute.Home}>Home</NavLink>
        <NavLink to={SiteRoute.HowItWorks}>How it works</NavLink>
        <NavLink to={SiteRoute.Install}>Install</NavLink>
        <NavLink to={SiteRoute.LabGuide}>Lab</NavLink>
        <NavLink to={SiteRoute.Support}>Support</NavLink>
      </nav>
    </header>
  )
}
