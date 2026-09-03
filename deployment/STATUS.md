# Deployment Preparation Status

Last updated: 2026-08-30T21:31:33+01:00

## Chrome Web Store publisher

- Developer registration: Complete
- Registration fee: Paid
- Publisher name: Jules TNK
- Contact email: Verified
- Trader declaration: Individual trader
- Trader verification: Support request submitted after two unsuccessful automated attempts
- Google support ticket: 4-6237000041310
- Google support status: Ticket created; waiting for an associate response
- Google support last checked: 2026-08-29T09:55:44+01:00
- Store item created: No
- Extension package uploaded: No
- Submitted for review: No

The selected Individual Google Payments profile is linked to Chrome Web Store. Google Payments shows no verification alerts. Chrome Web Store rejected the automated trader-verification attempt without a field-level reason, and the notification emails directed the publisher back to the dashboard. One Stop Support received a diagnostic request with an address-free error screenshot.

## Firebase Hosting

- Project display name: Jules TNK Space
- Preferred project ID: Unavailable globally
- Created project ID: jules-tnk-space-web
- Classic Hosting: Deployed
- Generated Hosting URL: https://jules-tnk-space-web.web.app
- Production website deployment timestamp: 2026-08-29T20:00:00+01:00
- Firebase CLI: 15.11.0
- Product, install, lab, Privacy, Terms, and Support routes: HTTP 200
- Security headers: Verified
- Browser console errors or warnings: None
- Analytics, Authentication, Firestore, Functions, App Hosting: Disabled

## Custom domain

- Hostname: webmcp-forge.jules-tnk.com
- Cloudflare record audit: No conflict found
- DNS record: CNAME to jules-tnk-space-web.web.app
- Cloudflare proxy state: DNS only
- Google Public DNS: Exact CNAME detected
- Cloudflare public resolver: Exact CNAME detected
- Firebase custom domain: Live
- Certificate: Active and valid for webmcp-forge.jules-tnk.com
- Search Console ownership: Verified for the publisher account

## Publication kit

- Official website: Deployed on the custom domain and Firebase fallback URL
- Privacy policy: Deployed on the custom domain and Firebase fallback URL
- Terms of service: Deployed on the custom domain and Firebase fallback URL
- Support page: Deployed on the custom domain and Firebase fallback URL
- Store listing draft: Complete
- Permission justifications: Complete draft
- Data disclosures: Complete draft
- Reviewer instructions: Complete draft
- Asset requirements: Complete
- Current extension ZIP: `experiments/webmcp-capability-forge/output/webmcp-capability-forge-extension.zip`
- Current extension ZIP SHA-256: `6D91F158E0F242EAA018B016AE7A3620E2D57812A89F0725155E8B4D61880886`
- Current extension ZIP size: 2,040,023 bytes

## Production website takeover

- Current website: Official WebMCP Capability Forge production website
- Application source: `experiments/webmcp-capability-forge/website`
- Verified build output: `experiments/webmcp-capability-forge/website/dist`
- Firebase release source: `deployment/firebase/production-public`
- Takeover status: Complete and verified on 2026-08-29
- Cutover runbook: `deployment/firebase/PRODUCTION-TAKEOVER.md`

The temporary prelaunch source has been removed. Firebase retains the prior release in Hosting history for rollback. The production cutover used Hosting only; Analytics, Authentication, Firestore, Functions, and App Hosting remain disabled.

The latest lifecycle wording corrections are deployed. Both Hosting domains serve `assets/index-bW4ee1qp.js`, including the autonomous `capability_forge` entry and derived mixed-provenance explanation.

## Verification

- Workspace coding-rule check, type checking, unit tests, and builds: Passed
- Core tests: 38 passed
- Extension tests: 67 passed
- Loaded-extension browser suite: 31 passed, 1 intentionally skipped duplicate Store screenshot
- Publication-kit validator tests: 4 passed
- Publication-kit production content validation: Passed with package and screenshot gates active
- Firebase fallback routes: All product, install, lab, legal, support, robots, and sitemap routes return HTTP 200
- Custom-domain routes: All product, install, lab, legal, support, robots, and sitemap routes return HTTP 200
- Custom-domain security headers: Verified and match the Firebase fallback deployment
- Live Chrome rendering: Homepage, Lab Guide, and Terms headings verified; no horizontal overflow or console issues
- Latest custom-domain and Firebase-fallback verification: All six checked routes returned HTTP 200; the current bundle contains the corrected copy; CSP and `X-Content-Type-Options: nosniff` match on both hosts
- TLS hostname validation: Passed

## Remaining release gates

- Production ZIP upload
- Native WebMCP and actual-agent evidence
- Latest website-copy deployment and live re-verification
- Final legal and Store dashboard reconciliation
- Chrome Web Store Submit for Review
- Public release
