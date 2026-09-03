# Production Website Takeover

## Previous deployment

Before the production cutover, `https://webmcp-forge.jules-tnk.com` served a temporary static prelaunch site. Its local source was removed after the official website passed production verification. Firebase retains the previous release in Hosting history for rollback.

## Production source

The finished website under:

```text
experiments/webmcp-capability-forge/website
```

replaced the prelaunch site on 2026-08-29. The implemented Vite website package builds to:

```text
experiments/webmcp-capability-forge/website/dist
```

## Cutover gate

Do not replace the prelaunch deployment until all of these conditions pass:

- [x] The merged workspace's coding-rule check passes.
- [x] Type checking passes.
- [x] Domain and integration tests pass.
- [x] Production build passes.
- [x] Loaded-extension browser journeys pass.
- [x] The production website contains `/`, `/privacy`, `/support`, and `/lab/guide`.
- [x] Privacy and permission statements match the production extension.
- [x] The production website contains no unfinished claims, mock screenshots, secrets, or private test data.
- [x] The Firebase Hosting configuration has been reviewed against the actual build output.

## Cutover procedure

1. Build `experiments/webmcp-capability-forge/website` using its verified production command.
2. Confirm the produced website directory and inspect its contents before changing `firebase.json`.
3. Copy the verified website build into `deployment/firebase/production-public` and keep `hosting.public` pointed to that Firebase-local release directory. Firebase Hosting rejects public directories outside the Firebase project directory.
4. Preserve the existing Content Security Policy, Permissions Policy, Referrer Policy, and `nosniff` headers unless the production application documents a required change.
5. Add Firebase rewrites for client-side routes only when the production router requires them.
6. Deploy with `firebase deploy --only hosting` from `deployment/firebase`.
7. Verify `https://webmcp-forge.jules-tnk.com`, `/privacy`, `/support`, and `/lab/guide` over valid HTTPS.
8. Run browser console, responsive-layout, WebMCP, and extension-installation checks against the custom domain.
9. Update `deployment/STATUS.md`, reviewer instructions, listing copy, privacy disclosures, and screenshots with production evidence.
10. Remove the prelaunch source after the production deployment and Firebase rollback path have been verified.

## Rollback

Firebase Hosting keeps prior releases. If the production website fails post-deployment checks, roll back to the last verified release in the Firebase Hosting console and record the failed release in `deployment/STATUS.md` before attempting another deployment.

## Ownership boundary

The prelaunch deployment work must not modify files under `experiments/webmcp-capability-forge`. The merged application owns its source and build. This runbook owns only the verified handoff from that build to Firebase Hosting.
