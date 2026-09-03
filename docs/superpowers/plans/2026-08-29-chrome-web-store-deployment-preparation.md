# Chrome Web Store Deployment Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register the Chrome Web Store publisher, create and connect Firebase Hosting, publish truthful privacy and support pages, and prepare every non-package artifact required for a later WebMCP Capability Forge submission.

**Architecture:** Keep deployment preparation under a new top-level `deployment/` folder so concurrent extension work remains untouched. Use the Chrome Web Store and Firebase consoles for account-only operations, Firebase CLI for project and Hosting operations, Cloudflare Dashboard for exact Firebase-provided DNS records, and small Node validators for the static site and publication kit.

**Tech Stack:** Chrome Web Store Developer Dashboard, Chrome with two-step verification, Firebase CLI 15.11.0, classic Firebase Hosting, Cloudflare DNS, Google Search Console, Node.js 22, static HTML/CSS, Node test runner

**Spec:** `docs/superpowers/specs/2026-08-29-chrome-web-store-deployment-preparation-design.md`

## Global Constraints

- Work in the current repository and branch. Create no branch, worktree, or Git commit.
- Do not modify either existing prototype or `experiments/webmcp-capability-forge/` while the merged extension is under construction.
- Store deployment files only under `deployment/` plus this plan and the approved spec.
- Chrome owner account: `julestnk.dev@gmail.com`.
- Public publisher name: **Jules TNK**.
- Publisher type: **Individual trader**.
- Firebase display name: **Jules TNK Space**.
- Try Firebase project ID `jules-tnk-space`; use approved fallback `jules-tnk-space-web` only when Google reports the first ID unavailable.
- Production hostname: `webmcp-forge.jules-tnk.com`.
- Use classic Firebase Hosting only. Enable no Analytics, Authentication, Firestore, Functions, App Hosting, or emulator.
- The publisher must personally accept agreements, pay fees, enter legal identity data, submit trader verification, submit the extension for review, and release it.
- Do not store legal name, address, phone number, payment data, or identity documents in project files or assistant-visible output.
- Read Cloudflare DNS before writing. Do not overwrite a record at `webmcp-forge.jules-tnk.com`.
- Add only DNS values displayed by Firebase or Google Search Console. Keep verification and Firebase routing records DNS-only.
- Publish no extension ZIP, screenshots, or store item before the finished extension passes its later manifest and behavior audit.
- The prelaunch website must state that the extension is in development and must use no analytics, cookies, forms, tracking pixels, or external embeds.
- Dashboard privacy answers, privacy policy, prominent disclosure, listing, and finished extension behavior must agree.

## Locked file structure

```text
deployment/
  STATUS.md
  scripts/
    validate-prelaunch-site.mjs
    validate-prelaunch-site.test.mjs
    validate-publication-kit.mjs
    validate-publication-kit.test.mjs
  firebase/
    firebase.json
    .firebaserc
    public/
      index.html
      styles.css
      privacy/index.html
      support/index.html
  chrome-web-store/
    publisher-profile.md
    listing/en-US.md
    privacy/privacy-policy.md
    privacy/data-disclosure-matrix.md
    privacy/permission-justifications.md
    privacy/prominent-disclosure.md
    review/test-instructions.md
    review/submission-checklist.md
    assets/README.md
```

---

### Task 1: Register and configure the Chrome Web Store publisher

**Files:**
- Create: `deployment/chrome-web-store/publisher-profile.md`
- Create: `deployment/STATUS.md`

**Interfaces:**
- Produces: registered publisher owned by `julestnk.dev@gmail.com`
- Produces: non-sensitive publisher record with name, contact email verification status, trader status, and dashboard state
- Blocks on: publisher actions for agreement acceptance, fee payment, and trader verification submission

- [ ] **Step 1: Open the Developer Dashboard in the approved Chrome account**

Navigate Chrome to `https://chrome.google.com/webstore/devconsole/`. Confirm the selected Google account is `julestnk.dev@gmail.com`. If Chrome shows another account, stop and ask the publisher to switch accounts; do not register under a substitute account.

Expected: the first-registration page shows the Developer Agreement and registration fee.

- [ ] **Step 2: Hand control to the publisher for registration**

Ask the publisher to read and accept the current Chrome Web Store Developer Agreement and complete the $5 payment. Do not click acceptance, type payment data, or confirm the charge.

Expected: the publisher returns to a registered Developer Dashboard.

- [ ] **Step 3: Configure non-sensitive publisher fields**

Set the publisher name to `Jules TNK`, add `julestnk.dev@gmail.com` as the contact email, request its verification message, and enable policy and item notifications. Ask the publisher to open Google's verification email and follow the verification link.

Expected: the Account page marks the contact email verified.

- [ ] **Step 4: Start individual-trader verification and hand control back**

Select Individual trader. Stop before entering legal name, address, phone, payment-profile, or identity values. Ask the publisher to complete and submit those fields directly.

Expected: the dashboard shows trader verification as submitted, pending, or verified. Record only that status.

- [ ] **Step 5: Record the non-sensitive publisher outcome**

Create `publisher-profile.md` with this structure and replace only the two status values with their observed dashboard states:

```markdown
# Chrome Web Store Publisher Profile

- Owner account: julestnk.dev@gmail.com
- Publisher name: Jules TNK
- Contact email: julestnk.dev@gmail.com
- Contact email status: Verified
- Publisher classification: Individual trader
- Trader verification status: Submitted
- Two-step verification: Enabled
- Distribution intent: Free, public, all regions, deferred publishing

No legal address, phone number, payment information, or identity evidence is stored in this repository.
```

- [ ] **Step 6: Verify Task 1**

Read the Developer Dashboard Account page and `publisher-profile.md` together.

Expected: account owner, publisher name, contact email, and displayed statuses agree. `deployment/STATUS.md` records account registration as complete and trader review as either complete or pending.

### Task 2: Build and validate the privacy-first prelaunch site

**Files:**
- Create: `deployment/firebase/public/index.html`
- Create: `deployment/firebase/public/styles.css`
- Create: `deployment/firebase/public/privacy/index.html`
- Create: `deployment/firebase/public/support/index.html`
- Create: `deployment/firebase/firebase.json`
- Create: `deployment/scripts/validate-prelaunch-site.mjs`
- Create: `deployment/scripts/validate-prelaunch-site.test.mjs`

**Interfaces:**
- Produces: static routes `/`, `/privacy`, and `/support`
- Produces: `PrelaunchSiteValidator.validate(rootDirectory)` returning an array of concrete validation messages

- [ ] **Step 1: Write the failing validator tests**

Use `node:test` and temporary directories. Require all three HTML pages, the exact canonical URLs, in-development language, visible Privacy and Support links, a Limited Use statement, and absence of scripts, forms, analytics hosts, cookie text, and unfinished markers.

Define `SiteFixture` as a test-local class in `validate-prelaunch-site.test.mjs`; its `create` method must write the supplied page strings into a fresh directory from `mkdtemp` and return that directory path.

```js
test('rejects a site that claims the extension is available', async () => {
  const root = await SiteFixture.create({
    home: '<html><body>Install now from the Chrome Web Store</body></html>',
  })
  const issues = await PrelaunchSiteValidator.validate(root)
  assert.ok(issues.includes('The homepage must state that the extension is in development.'))
})
```

- [ ] **Step 2: Run the test and confirm failure**

Run from `deployment/`:

```powershell
node --test scripts/validate-prelaunch-site.test.mjs
```

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement the validator**

Export one class named `PrelaunchSiteValidator`. Validate files and text without adding runtime dependencies. Treat `/\b(?:T[O]DO|T[B]D|FIXM[E])\b/i` as the unfinished-work marker pattern. Also fail on lorem ipsum, `<script`, `<form`, Google Analytics, Tag Manager, Facebook Pixel, external iframe, or a claim that the extension can already be installed.

- [ ] **Step 4: Create the prelaunch homepage**

Use this truthful primary copy:

```text
WebMCP Capability Forge is in development.

It is a browser extension for teaching, discovering, reviewing, and reusing browser workflows as WebMCP tools. The project is preparing for Chrome Web Store review and is not available for installation yet.
```

Explain Manual, Automatic, and Hybrid learning as intended product modes. Link to `/privacy` and `/support`. Use local CSS, semantic HTML, visible focus styles, and no JavaScript.

- [ ] **Step 5: Create Privacy and Support pages**

Privacy must describe local processing, WebMCP agent disclosure, retention, deletion through extension removal or tool deletion, no developer-controlled data server, blocked sensitive targets, permissions, contact email, and Chrome Web Store Limited Use compliance.

Support must provide `julestnk.dev@gmail.com`, the product name, response-scope expectations, and links back to the homepage and privacy policy. Include no contact form.

- [ ] **Step 6: Configure Firebase Hosting behavior**

Create `firebase.json` with `public` set to `public`, `cleanUrls` enabled, trailing slash disabled, and headers for all routes:

```json
{
  "hosting": {
    "public": "public",
    "cleanUrls": true,
    "trailingSlash": false,
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'" },
          { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
          { "key": "Referrer-Policy", "value": "no-referrer" },
          { "key": "X-Content-Type-Options", "value": "nosniff" }
        ]
      }
    ]
  }
}
```

- [ ] **Step 7: Run the prelaunch-site validation**

Run:

```powershell
node --test scripts/validate-prelaunch-site.test.mjs
node scripts/validate-prelaunch-site.mjs firebase/public
```

Expected: tests pass and the site validator prints `Prelaunch site validation passed.`

### Task 3: Create the Firebase project and deploy classic Hosting

**Files:**
- Create: `deployment/firebase/.firebaserc`
- Modify: `deployment/STATUS.md`

**Interfaces:**
- Consumes: validated `deployment/firebase/public`
- Produces: Firebase project **Jules TNK Space**, one default Hosting site, and a live `web.app` prelaunch URL

- [ ] **Step 1: Verify Firebase CLI ownership context**

Run:

```powershell
firebase --version
firebase login:list
firebase projects:list
```

Expected: Firebase CLI 15.11.0 or newer and active login `julestnk.dev@gmail.com`. Stop if another account is active.

- [ ] **Step 2: Create the preferred Firebase project**

Run:

```powershell
firebase projects:create jules-tnk-space --display-name "Jules TNK Space"
```

Expected: project creation succeeds. If and only if Firebase reports that this project ID is unavailable, run:

```powershell
firebase projects:create jules-tnk-space-web --display-name "Jules TNK Space"
```

Stop for other errors instead of consuming the approved fallback.

- [ ] **Step 3: Bind the exact created project**

Write `.firebaserc` with the project ID that Firebase created:

```json
{
  "projects": {
    "default": "jules-tnk-space"
  }
}
```

Use `jules-tnk-space-web` in that file only when the approved fallback was created.

- [ ] **Step 4: Deploy only classic Hosting**

From `deployment/firebase`, run:

```powershell
firebase deploy --only hosting
```

Expected: Firebase deploys only Hosting and prints the `web.app` and `firebaseapp.com` URLs. Do not initialize or deploy another Firebase product.

- [ ] **Step 5: Verify the generated Hosting URL**

Use `Invoke-WebRequest` against `/`, `/privacy`, and `/support`. Require HTTP 200, exact product name, in-development statement, security headers, and no external script requests.

```powershell
$origin = 'https://jules-tnk-space.web.app'
$routes = @('/', '/privacy', '/support')
foreach ($route in $routes) {
  $response = Invoke-WebRequest -Uri "$origin$route" -UseBasicParsing
  if ($response.StatusCode -ne 200) { throw "Route failed: $route" }
}
```

Use the fallback hostname when the fallback project ID was created.

- [ ] **Step 6: Record the Firebase outcome**

Update `deployment/STATUS.md` with the exact project ID, generated Hosting URL, deployment timestamp, Firebase CLI version, and route verification result. Record Analytics and all other Firebase products as disabled.

### Task 4: Connect the Cloudflare-managed custom domain and verify ownership

**Files:**
- Create: `deployment/firebase/DNS-RECORDS.md`
- Modify: `deployment/STATUS.md`

**Interfaces:**
- Consumes: live Firebase Hosting site and Cloudflare zone `jules-tnk.com`
- Produces: valid HTTPS at `webmcp-forge.jules-tnk.com`
- Produces: Search Console ownership available to the publisher account

- [ ] **Step 1: Start Firebase custom-domain setup**

Open the Firebase Hosting console for the created project. Choose **Add custom domain**, enter `webmcp-forge.jules-tnk.com`, and advance until Firebase displays ownership and routing records. Do not invent or normalize the displayed targets.

- [ ] **Step 2: Inspect Cloudflare before writing**

Open Cloudflare DNS for `jules-tnk.com` and search the exact hostname `webmcp-forge`. If an A, AAAA, CNAME, or delegated NS record already owns that hostname, stop and show it to the publisher.

Expected: no conflicting record exists.

- [ ] **Step 3: Add Firebase-provided DNS records**

Add each exact TXT, A, AAAA, or CNAME value Firebase displays. Set A, AAAA, and CNAME records to DNS-only. TXT records are DNS-only by definition. Keep the TTL on Auto unless Firebase specifies another value.

Before saving each record, compare type, name, content, and proxy status with the Firebase screen. Do not delete unrelated records.

- [ ] **Step 4: Record non-secret DNS evidence**

Write `DNS-RECORDS.md` with the hostname, record types, Cloudflare proxy state, creation date, Firebase verification state, and certificate state. DNS targets are public and may be recorded; do not record Cloudflare account identifiers or tokens.

- [ ] **Step 5: Complete Firebase verification**

Return to Firebase and select Verify. If Firebase reports propagation pending, use `Resolve-DnsName` to compare public answers with the records entered. Leave the records unchanged while Google provisions the certificate.

- [ ] **Step 6: Verify Google Search Console ownership**

Open Search Console under `julestnk.dev@gmail.com`. Add or select the domain property `jules-tnk.com`. If verification requires a new TXT record, add the exact Google-provided value in Cloudflare without deleting Firebase records. Verify the property.

Expected: the publisher account can select the owned domain later as the Chrome Web Store official URL.

- [ ] **Step 7: Verify custom-domain HTTPS**

After Firebase reports Connected, request all three routes:

```powershell
$origin = 'https://webmcp-forge.jules-tnk.com'
$routes = @('/', '/privacy', '/support')
foreach ($route in $routes) {
  $response = Invoke-WebRequest -Uri "$origin$route" -UseBasicParsing
  if ($response.StatusCode -ne 200) { throw "Route failed: $route" }
}
```

Expected: valid certificate for `webmcp-forge.jules-tnk.com`, HTTP 200 on all routes, and the same content as the Firebase fallback URL. If certificate provisioning remains pending, record the state and recheck within Firebase's documented 24-hour window.

### Task 5: Prepare and validate the Chrome Web Store publication kit

**Files:**
- Create: `deployment/chrome-web-store/listing/en-US.md`
- Create: `deployment/chrome-web-store/privacy/privacy-policy.md`
- Create: `deployment/chrome-web-store/privacy/data-disclosure-matrix.md`
- Create: `deployment/chrome-web-store/privacy/permission-justifications.md`
- Create: `deployment/chrome-web-store/privacy/prominent-disclosure.md`
- Create: `deployment/chrome-web-store/review/test-instructions.md`
- Create: `deployment/chrome-web-store/review/submission-checklist.md`
- Create: `deployment/chrome-web-store/assets/README.md`
- Create: `deployment/scripts/validate-publication-kit.mjs`
- Create: `deployment/scripts/validate-publication-kit.test.mjs`

**Interfaces:**
- Consumes: approved product design, public homepage, privacy URL, and support URL
- Produces: `PublicationKitValidator.validate(deploymentRoot)` and reviewer-ready draft fields
- Blocks submission until a finished manifest, ZIP, screenshots, and runtime audit exist

- [ ] **Step 1: Write the failing publication-validator tests**

Require exact public URLs, a short description no longer than 132 characters, category, single purpose, all planned permission justifications, no-remote-code answer, local-storage disclosure, AI-agent disclosure, Limited Use statement, asset dimensions, and explicit deferred gates.

Define `PublicationKitFixture` as a test-local class in `validate-publication-kit.test.mjs`; its `create` method must write a complete valid kit into a fresh temporary directory and apply the requested field override before validation.

```js
test('rejects a short description over 132 characters', async () => {
  const kit = await PublicationKitFixture.create({ shortDescription: 'x'.repeat(133) })
  const issues = await PublicationKitValidator.validate(kit)
  assert.ok(issues.includes('The manifest short description exceeds 132 characters.'))
})
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```powershell
node --test scripts/validate-publication-kit.test.mjs
```

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement the publication-kit validator**

Export one class named `PublicationKitValidator`. Reject missing files, unfinished markers, inconsistent URLs, absent disclosures, unlisted permissions, unsupported availability claims, and a checklist that permits item creation before the final audit.

- [ ] **Step 4: Write the English listing draft**

Use these locked fields:

```text
Name: WebMCP Capability Forge
Category: Developer Tools
Language: English
Short description: Teach or let an AI agent discover reusable browser workflows, review them, and expose them as local WebMCP tools.
Homepage: https://webmcp-forge.jules-tnk.com
Privacy: https://webmcp-forge.jules-tnk.com/privacy
Support: https://webmcp-forge.jules-tnk.com/support
Distribution: Free, public, all regions, deferred publishing
```

Use this detailed-description draft:

```text
WebMCP Capability Forge helps you turn browser tasks into reusable WebMCP tools on websites you choose to enable.

Teach a workflow by performing it yourself, let an AI agent explore within clear safety limits, or combine both approaches in one learning session. Before a learned workflow becomes reusable, Capability Forge shows its scope, inputs, page targets, actions, expected effects, and evidence for your review.

Key capabilities:
• Manual, Automatic, and Hybrid workflow learning
• Human review before activation or repair
• Bounded page exploration with sensitive fields blocked
• Local workflow storage, version history, and reload restoration
• Verification, failure evidence, and reviewed repair

You grant website access one site at a time. Consequential actions require confirmation. Capability Forge does not execute agent-generated JavaScript and does not send workflow data to a developer-controlled server.
```

Reconcile every sentence against the finished extension before store submission. Avoid keyword lists and performance claims.

- [ ] **Step 5: Write privacy and dashboard answer drafts**

Use this single-purpose statement:

```text
WebMCP Capability Forge lets users create and reuse reviewed WebMCP workflows on websites they explicitly enable.
```

State **No remote code**. Prepare conservative disclosures for current URL/path, visible website content, interactions, non-sensitive form examples, extracted results, local workflow storage, and transfer of bounded observations to a user-selected AI agent. State that the developer receives no page or workflow data.

- [ ] **Step 6: Write permission justifications**

Cover `activeTab`, `scripting`, `storage`, `tabs`, `sidePanel`, and optional HTTP/HTTPS host permissions. State the direct user-facing feature each permission enables and that optional host access is requested only for a user-enabled site. Mark the file for reconciliation against the final manifest.

- [ ] **Step 7: Write the prominent disclosure**

Use this approved disclosure copy for later implementation before site enablement and learning:

```text
Capability Forge processes this page's URL, visible controls, your workflow interactions, and bounded page content to learn and run workflows. Workflow data is stored locally in Chrome. A connected AI agent may receive bounded page observations and results. Sensitive fields are blocked.
```

Require a Privacy link and direct **Enable on this site** or **Start learning** action after the disclosure.

- [ ] **Step 8: Write reviewer instructions and deferred gates**

Use the public deterministic lab route `https://webmcp-forge.jules-tnk.com/lab/guide` as the future reviewer entry. State that submission remains blocked until this route exists and the production ZIP passes Manual, Automatic, Hybrid, reload, risk-confirmation, stale-target, and repair checks.

The checklist must require manifest audit, production ZIP root manifest, higher version on updates, no remote code, exact permission reconciliation, three public URLs, icon, at least one actual screenshot, small promo tile, test instructions, privacy consistency, deferred publishing, and publisher-controlled Submit for Review.

- [ ] **Step 9: Write the asset brief**

Record:

- 128x128 PNG icon with about 96x96 artwork and transparent padding.
- 1280x800 full-bleed screenshots, one required and five preferred.
- Required 440x280 PNG or JPEG small promo tile.
- Optional 1400x560 PNG or JPEG marquee.
- No mock screenshots, Google endorsement cues, unreadable text, or unverified claims.

- [ ] **Step 10: Run publication-kit validation**

Run:

```powershell
node --test scripts/validate-publication-kit.test.mjs
node scripts/validate-publication-kit.mjs .
```

Expected: tests pass and the validator prints `Publication kit validation passed with deferred package and screenshot gates active.`

### Task 6: Produce the deployment-preparation handoff

**Files:**
- Modify: `deployment/STATUS.md`
- Modify: `deployment/chrome-web-store/review/submission-checklist.md`

**Interfaces:**
- Consumes: account, Firebase, domain, site, and publication-kit evidence from Tasks 1 through 5
- Produces: exact completed, pending-external-review, and deferred-extension-dependent status

- [ ] **Step 1: Run all local validators**

Run from `deployment/`:

```powershell
node --test scripts/validate-prelaunch-site.test.mjs
node --test scripts/validate-publication-kit.test.mjs
node scripts/validate-prelaunch-site.mjs firebase/public
node scripts/validate-publication-kit.mjs .
```

Expected: all tests and validators pass.

- [ ] **Step 2: Verify public endpoints and DNS**

Run:

```powershell
Resolve-DnsName webmcp-forge.jules-tnk.com
Invoke-WebRequest https://webmcp-forge.jules-tnk.com -UseBasicParsing
Invoke-WebRequest https://webmcp-forge.jules-tnk.com/privacy -UseBasicParsing
Invoke-WebRequest https://webmcp-forge.jules-tnk.com/support -UseBasicParsing
```

Expected: DNS answers match Firebase records, TLS is valid, and all pages return HTTP 200.

- [ ] **Step 3: Reconcile dashboard and local status**

Check the Developer Dashboard Account page. Record contact-email status and trader-verification status without identity details. Do not create a store item.

- [ ] **Step 4: Update the submission checklist**

Mark account, hosting, domain, public privacy, support, listing draft, disclosures, permission draft, reviewer draft, and asset brief complete. Leave package upload, manifest reconciliation, screenshots, automated extension evidence, native WebMCP evidence, Submit for Review, and public release unchecked.

- [ ] **Step 5: Write the final status**

`deployment/STATUS.md` must include:

- Exact Firebase project ID and generated URL.
- Custom-domain and certificate state.
- Chrome Web Store registration state.
- Contact-email and trader-review state.
- Search Console verification state.
- Local validator results.
- Public route results.
- Deferred blockers tied to extension completion.
- Date and timezone of verification.

- [ ] **Step 6: Confirm no submission occurred**

Verify the Developer Dashboard contains no newly uploaded item from this preparation task. Report that the environment is ready for the production extension, while submission and release remain blocked by the approved checklist.

## Execution checkpoints

Pause for the publisher at these points:

1. Developer Agreement and $5 registration fee.
2. Trader legal identity and verification submission.
3. Any existing DNS record at `webmcp-forge.jules-tnk.com`.
4. Any Firebase or Search Console DNS value that conflicts with an existing record.
5. Chrome Web Store Submit for Review and public release, which remain outside this plan.

## Final verification contract

Do not describe deployment preparation as complete until:

- The Chrome Web Store developer account exists under `julestnk.dev@gmail.com`.
- Publisher name and contact email are configured and contact email is verified.
- Trader verification is submitted or its remaining Google review state is documented.
- Firebase project **Jules TNK Space** exists under the approved account.
- Only classic Firebase Hosting is enabled and deployed.
- `webmcp-forge.jules-tnk.com`, `/privacy`, and `/support` serve valid HTTPS and accurate prelaunch content.
- Search Console ownership is available to the publisher account.
- Both local validator suites pass.
- The publication kit contains no sensitive identity data or unfinished marker.
- The Chrome Web Store contains no uploaded item from this preparation task.
- The checklist continues to block item creation, package upload, screenshots, review submission, and release until the extension is complete.
