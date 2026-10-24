# Executed API privacy prompt

Adapted from the local prompt library's repo-grounded-implementation-loop. Refinements: (1) inventory endpoints; (2) preserve public presentation while identifying private data; (3) include SSR, media, aliases and the separate service; (4) add adversarial denial/serialization tests, compatibility and release boundaries.

```text
Work in C:\Users\Deej\Documents\GitHub\yellowcollective.

Goal: preserve everything intentionally visible on public website pages and in the Farcaster Mini App, while ensuring API requests cannot disclose additional private records, storage metadata, moderation details, credentials, raw service state or internal diagnostics.

Inspect current instructions, package versions, dirty files, every pages/api handler, re-exports, server-rendered page props, serializers, auth helpers, client callers, storage capability routes, and services/metagov HTTP routes. Inventory each route's public/user/owner/admin/service policy. A connected wallet, hidden URL, CORS or frontend guard is not authorization. Public presentation data remains inspectable and collectable.

Execute the smallest coherent local fixes. Derive protected identities from verified signatures/tokens/sessions and enforce resource permissions on the server. Use explicit output field allowlists, including nested structures; preserve public artwork, animation, video playback, identity, voting, profile and DAO information. Keep original domain/storage records intact. Remove hidden aggregates and raw provider errors. Avoid shared caching of private responses. Protect raw service exports, authenticated uploads, and any untrusted server fetch that can expose internal network data. Update legitimate client callers alongside new checks.

Verify direct unauthenticated/invalid/cross-identity denial before private reads or paid provider calls; public success; unknown-field/credential-marker stripping; unsupported methods; safe failure responses; media/SSR compatibility; DNS and redirect restrictions. Use synthetic fixtures and existing signature/session/ownership tests. Run the full repository suite, dedicated privacy tests, typecheck, lint, build, and a bounded local HTTP check when feasible. Record failures and limits honestly; do not call source review proof of deployed security.

Preserve unrelated output assets and dirty work. Do not print secret values, access production data, change provider settings, provision services, rotate credentials, run migrations, commit, push, deploy, sign or transact. Document any new environment requirement and synchronized rollout/rollback needed to preserve public behavior. No memory or vault writes.

Deliver the executed prompt, complete endpoint inventory, concise findings/fixes, verification evidence, and remaining production checks. Do not promise absolute security or that visible public content cannot be collected.
```
