# Chrome Web Store Deployment Preparation Design

## Summary

Prepare the developer account, hosting infrastructure, compliance disclosures, store metadata, and review materials required to publish WebMCP Capability Forge as a Chrome extension. Keep this work isolated from the extension implementation that is still in progress. Defer item creation, package upload, screenshots, review submission, and public release until the finished extension passes a manifest and behavior audit.

## Publisher identity

- Google owner account: `julestnk.dev@gmail.com`
- Public publisher name: **Jules TNK**
- Publisher classification: **Individual trader**
- Verified contact email: `julestnk.dev@gmail.com`
- Two-step verification: enabled
- Developer registration: first registration
- Registration fee: one-time $5 fee
- Distribution target: free, public, all supported regions, deferred publishing

The publisher will enter legal name, address, phone number, payment information, and identity evidence directly into Google forms. Project files and assistant-visible messages must not retain those values.

## Hosting identity

- Firebase account owner: `julestnk.dev@gmail.com`
- Firebase display name: **Jules TNK Space**
- Preferred project ID: `jules-tnk-space`
- Approved fallback project ID: `jules-tnk-space-web`
- Hosting product: classic Firebase Hosting for static files
- Production hostname: `webmcp-forge.jules-tnk.com`
- Homepage: `https://webmcp-forge.jules-tnk.com`
- Privacy policy: `https://webmcp-forge.jules-tnk.com/privacy`
- Support: `https://webmcp-forge.jules-tnk.com/support`
- DNS provider: Cloudflare

Do not enable Firebase Analytics, Authentication, Firestore, Functions, App Hosting, or another Firebase product. Do not use the Firebase emulator. Firebase will supply the ownership and routing DNS values. Add those exact records to Cloudflare with verification records set to DNS-only. Stop if the `webmcp-forge` hostname already has a conflicting record.

## Staged publication approach

Complete the reversible infrastructure and publication preparation before creating a Chrome Web Store item.

### Complete now

1. Reach the Chrome Web Store developer registration page under the approved Google account.
2. Let the publisher accept the Developer Agreement and pay the registration fee.
3. Configure publisher name, contact email, trader declaration, and account notifications.
4. Let the publisher enter and submit legal trader verification information.
5. Create the approved Firebase project and enable classic Hosting.
6. Deploy an accurate prelaunch site with homepage, privacy, and support pages.
7. Connect the custom hostname and add Firebase-provided Cloudflare DNS records.
8. Verify DNS, Firebase certificate status, HTTPS, and the three public routes.
9. Prepare store listing, privacy, permission, review, and asset documents.

### Defer until the extension is complete

- Chrome Web Store item creation.
- Extension ZIP upload.
- Final manifest privacy audit.
- Final screenshots and promotional media.
- Reviewer execution against the production package.
- Submit for Review.
- Public release.

## Isolated deployment workspace

```text
deployment/
  chrome-web-store/
    publisher-profile.md
    listing/
      en-US.md
    privacy/
      privacy-policy.md
      data-disclosure-matrix.md
      permission-justifications.md
      prominent-disclosure.md
    review/
      test-instructions.md
      submission-checklist.md
    assets/
      README.md
  firebase/
    firebase.json
    .firebaserc
    public/
      index.html
      privacy/
        index.html
      support/
        index.html
```

This workspace owns publication preparation. It must not modify files inside either existing prototype or the merged extension under construction.

## Prelaunch website

The prelaunch website must:

- Identify the product as WebMCP Capability Forge.
- State that the extension is in development and not yet available in the Chrome Web Store.
- Explain Manual, Automatic, and Hybrid workflow learning without claiming unfinished capabilities work.
- Link visibly to Privacy and Support.
- Use no analytics, tracking pixels, cookies, forms, or external embeds.
- Include no extension download or installation package.
- Use static files and restrictive security headers supported by Firebase Hosting.

The finished product website can replace this prelaunch content after the extension build is ready.

## Privacy position

Chrome Web Store policy treats local processing as data handling. WebMCP Capability Forge may process:

- Current website origin and path.
- Visible website content and control labels.
- User interactions recorded to teach workflows.
- Non-sensitive form examples.
- Extracted workflow results.
- Capability definitions, revisions, and bounded execution evidence.

The developer does not receive this data. The extension stores bounded workflow information in `chrome.storage.local`. A user-selected AI agent may receive bounded observations and workflow results through WebMCP. The privacy policy and prominent disclosure must explain this transfer before site enablement or learning begins.

The extension must block credentials, payment data, authentication codes, file inputs, and other sensitive targets. The publication documents must stay consistent with the finished extension behavior and the dashboard declarations.

## Privacy dashboard preparation

Prepare drafts for:

- Narrow single-purpose statement.
- Justification for each required and optional manifest permission.
- No-remote-code declaration.
- Website-content, user-interaction, form-example, URL/path, and local-storage handling.
- Limited Use certifications.
- Privacy policy URL.
- Prominent disclosure shown before data processing starts.

Do not finalize checkbox selections until the production manifest and behavior have been audited.

## Store listing preparation

Prepare an English listing with:

- Product name.
- Manifest short description of no more than 132 characters.
- Detailed description with one overview paragraph and a concise feature list.
- Primary category recommendation.
- Homepage, privacy, and support URLs.
- Public publisher name.
- Free, public, all-regions, deferred-publishing distribution.
- Accurate limitations and human-approval boundaries.
- No claims about rankings, endorsement, availability, performance, or compatibility that lack evidence.

## Permission justification draft

Prepare justifications for the planned permissions, subject to the final manifest audit:

- `activeTab`: act on the current tab after a direct user gesture.
- `scripting`: inject packaged recorder, explorer, and WebMCP runtime code into an enabled site.
- `storage`: retain approved local workflows, revisions, and bounded evidence.
- `tabs`: identify the enabled tab, route state, and lifecycle for the side panel and continuation.
- `sidePanel`: show the learning, review, confirmation, tool, and evidence interface beside the website.
- Optional HTTP/HTTPS host access: grant access only for a site the user enables.

Remove any permission the final build does not need. Minimum-permission policy applies to optional permissions as well as required permissions.

## Required media

Prepare the asset workflow for:

- 128x128 PNG store and package icon, with artwork sized for Chrome icon guidance.
- At least one 1280x800 full-bleed screenshot, with up to five after the extension is complete.
- Required 440x280 small promotional image.
- Optional 1400x560 marquee image.

Do not create screenshots from mockups. Screenshots must show the current production extension. Promo artwork must use the approved product identity and avoid Google or Chrome endorsement cues.

## Reviewer instructions

Prepare instructions that cover:

- How to enable the extension on the deterministic lab origin.
- How to open the side panel.
- How to start Manual, Automatic, and Hybrid sessions.
- How human approval works.
- How to verify persistence after reload.
- How to trigger stale-target detection and reviewed repair.
- Why optional host permissions, page-content handling, and WebMCP registration are necessary.
- Which flows are excluded and require no reviewer credentials.

Do not provide personal credentials. The final test instructions must use a public deterministic lab.

## Account action boundaries

The publisher must take control for:

- Accepting the Chrome Web Store Developer Agreement.
- Paying the registration fee.
- Entering legal trader information.
- Entering phone, address, payment, or identity data.
- Submitting trader verification.
- Submitting the extension for review.
- Releasing the approved extension publicly.

The assistant may navigate to those steps and validate non-sensitive context before handoff.

## DNS and domain safety

- Read existing Cloudflare records before making changes.
- Add only records Firebase displays for the selected Hosting site.
- Keep verification CNAME or TXT records DNS-only.
- Do not overwrite an existing `webmcp-forge` record.
- Verify the public Firebase fallback URL before changing DNS.
- Allow up to 24 hours for Firebase certificate provisioning.
- Confirm the final HTTPS certificate covers `webmcp-forge.jules-tnk.com`.

## Verification

Deployment preparation is complete when:

- The Chrome Web Store developer account is registered.
- Publisher email and trader status are configured.
- Trader verification is submitted or its remaining Google review state is documented.
- Firebase project **Jules TNK Space** exists under the approved account.
- Classic Firebase Hosting serves the prelaunch site.
- The custom hostname resolves to Firebase and serves valid HTTPS.
- Homepage, Privacy, and Support return successful responses.
- The isolated publication kit contains no placeholder values or sensitive identity data.
- Privacy statements match the approved extension design.
- Store assets have exact requirement briefs, while screenshots remain deferred.
- The release checklist blocks item creation and submission until the finished extension passes audit.

## Official references

- Chrome Web Store developer registration: https://developer.chrome.com/docs/webstore/register
- Developer account setup: https://developer.chrome.com/docs/webstore/set-up-account
- Trader verification: https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq
- Extension preparation: https://developer.chrome.com/docs/webstore/prepare
- Listing fields: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Privacy fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- User-data policy: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- 2026 privacy update: https://developer.chrome.com/blog/cws-policy-updates-2026
- Image requirements: https://developer.chrome.com/docs/webstore/images
- Firebase Hosting setup: https://firebase.google.com/docs/hosting/quickstart
- Firebase custom domain: https://firebase.google.com/docs/hosting/custom-domain
- Cloudflare verification records: https://developers.cloudflare.com/dns/proxy-status/use-cases/
