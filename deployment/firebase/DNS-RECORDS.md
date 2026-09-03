# Firebase Custom Domain DNS Record

- Hostname: webmcp-forge.jules-tnk.com
- Record type: CNAME
- Target: jules-tnk-space-web.web.app
- Cloudflare proxy status: DNS only
- TTL: Auto, observed publicly as 300 seconds
- Created: 2026-08-29T01:52:02+01:00
- Conflict audit: No prior record used the hostname
- Google Public DNS: Exact CNAME detected
- Cloudflare public resolver: Exact CNAME detected
- Firebase custom domain: Live
- Firebase certificate: Active; hostname appears in the certificate Subject Alternative Names
- Search Console domain property: Verified for the publisher account

No existing DNS record was modified or deleted. Cloudflare initially saved the new record with its default Proxied state after browser control detached before the proxy toggle ran. The record was reopened, changed to DNS only, saved, and verified in the DNS table and both public resolvers.

Verified on 2026-08-29T09:51:59+01:00: homepage, Privacy, and Support returned HTTP 200 over valid HTTPS with the configured security headers.
