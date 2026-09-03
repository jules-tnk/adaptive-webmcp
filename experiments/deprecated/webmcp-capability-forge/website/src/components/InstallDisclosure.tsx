import { Link } from 'react-router-dom'

import { SiteRoute } from '../app/site-route'

export function InstallDisclosure() {
  return (
    <div className="install-disclosure" aria-label="Chrome extension installation disclosure">
      <p className="eyebrow">Chrome extension</p>
      <p>
        Installing WebMCP Capability Forge adds a Chrome extension whose single purpose is to
        teach, discover, verify, and reuse browser workflows as WebMCP tools.
      </p>
      <Link className="button-primary" to={SiteRoute.Install}>
        View release status
      </Link>
    </div>
  )
}
