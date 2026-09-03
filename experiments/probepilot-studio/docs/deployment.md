# Deployment

ProbePilot Studio uses its own Firebase Hosting site inside the `Jules TNK Space` Firebase project. This keeps the existing default Hosting site and `webmcp-forge.jules-tnk.com` release unchanged.

## Production targets

| Resource | Value |
|---|---|
| Firebase project | `jules-tnk-space-web` |
| Hosting site | `probepilot-jules-tnk` |
| Firebase fallback | `https://probepilot-jules-tnk.web.app` |
| Custom domain | `https://probepilot.jules-tnk.com` |
| GitHub repository | `https://github.com/jules-tnk/adaptive-webmcp` (private) |

The `.firebaserc` file maps the `probepilot` Hosting target to `probepilot-jules-tnk`. Build and deploy from this directory:

```powershell
pnpm build
firebase deploy --only hosting:probepilot --project jules-tnk-space-web --config firebase.json
```

## DNS

Cloudflare hosts the `jules-tnk.com` zone. Firebase requested an unproxied A record for `probepilot.jules-tnk.com`, a Hosting ownership TXT record at the same name, and an ACME TXT record under `_acme-challenge.probepilot.jules-tnk.com`.

Keep the records unproxied so Firebase can verify ownership, serve the site, and renew its managed certificate.

## Release verification

The release check confirmed:

- the custom domain and Firebase fallback return HTTP 200;
- both hosts serve `/assets/index-BpNcD2ab.js`;
- a direct `/studio/nonexistent` request reaches the SPA fallback;
- JavaScript uses the correct content type;
- CSP, Permissions Policy, Referrer Policy, and `nosniff` headers are present;
- Chrome loads the launchpad, PCB preview, and 3D preview without console errors or warnings.
