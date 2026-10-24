# API privacy hardening - local verification

2026-10-21. Scope: preserve public website and Mini App content; prevent additional private data disclosure through API or page-prop responses. No deployment, commit, push, production access, secret generation/rotation, signing or transactions.

## What changed

- Inventoried all 88 Next.js endpoint files and the standalone metagov HTTP server; see endpoint-inventory.md.
- Round detail API and server-rendered page props now allowlist public fields, including nested awards, vote activity, trait payloads and video presentation metadata. Raw video object keys, storage byte metadata, hidden submission counts and moderation/deletion timestamps are omitted. Original domain records and admin/export functionality remain intact.
- The round-list and eligible-trait-rounds APIs use the same allowlist. Profile SSR applies it to round submissions as well. Public artwork, GIFs, video presence/playback, descriptions, awards, identity and vote information remain available.
- Removed arbitrary exception-message reflection from 36 handlers and raw provider-body forwarding from uploads and Snapshot vote submission. Typed submission-edit errors retain their explicitly defined user-facing messages. Legacy read-only routes now reject other methods and contain provider exceptions.
- IPFS upload proxy and signed-upload URL issuance require single-use signed wallet requests. The legitimate coin-media uploader signs the request before upload. Upload responses expose only the required content identifier. Noundry trait creation now binds the artist wallet to a signed payload, with its client updated together.
- Mini App user registration/update verifies Farcaster Quick Auth signature/issuer/audience through the existing official SDK package and binds the verified FID to the submitted FID. Browser context alone cannot choose another identity. SDK token failure does not block the notification prompt. The already locked/installed @farcaster/quick-auth package is now declared directly; no package versions were changed or installed.
- Notification service responses explicitly disable caching. Admin authorization errors fail closed with a generic message. Nonce issuance has bounded action/path inputs and an additional process-local rate limit.
- Metagov /health now exposes only {ok:true}. Raw /state, /state-file and per-proposal state require METAGOV_STATE_SECRET and fail closed if absent. The website forwards that secret server-side over HTTPS only, rejects redirects, and publishes allowlisted status fields with generic failure detail. No signer or bot execution code was changed.
- Proposal-update text fetches now reject private-network destinations, pin validated DNS results to sockets, revalidate redirects, reject malformed redirects, cap bytes and bound request duration.

## Verification

- yarn test: PASS, including the dedicated privacy suite (output/api-privacy-tests.log).
- yarn test:api-privacy / node tests/api-privacy.test.mjs: PASS. Covers all 28 admin handler denials before private loading, public serializer markers/nested metadata, alternate methods, safe error responses, Mini App missing/invalid credentials and FID mismatch, anonymous upload denial before provider calls, raw state auth, public metagov output, both round-list APIs, unsafe DNS/redirect/oversize denial, and inventory completeness.
- App TypeScript check: PASS (output/api-privacy-typecheck.log).
- yarn lint: PASS with three existing no-img-element warnings in unrelated components/pages (output/api-privacy-lint.log).
- yarn build: PASS, 16 static pages generated. Initial sandbox run failed spawning workers (EPERM); authorized retry succeeded. Database connection variables were explicitly empty during build so no production database was queried or changed. Missing-database server logs and public fallback content are expected for this isolated build (output/api-privacy-build.log).
- Built application local HTTP smoke: 11 checks PASS (http-smoke.json): public homepage/theme success; unsupported method denial; protected admin/notification/Mini App/upload denial; invalid profile input; database-error response without internal detail. Temporary server stopped after verification. No real private records were retrieved.
- git diff --check: PASS.
- Tracked environment artifact paths: only .env.sample and services/metagov/.env.example. Sensitive-looking NEXT_PUBLIC database/private-key/JWT/session/cron-secret variable-name check: no matches. This is a bounded source check, not historical incident or secret-scanner certification.
- Independent read-only QA review found an eligible-round serializer bypass and malformed-redirect exception; both were fixed and tested. Its HTTPS bearer-secret concern was fixed and documented as well.
- Standalone metagov full typecheck: NOT VERIFIED. Its own node_modules is absent; attempting the service project with root dependencies reports missing dotenv/Safe packages and ethers v5/v6 incompatibilities. The modified HTTP server has no remaining diagnostic in that attempt, and its behavior passes isolated tests. Do not claim a complete service build.

## Release requirements and remaining limits

1. Before releasing the service authentication change, configure the same server-only METAGOV_STATE_SECRET in website and metagov service, with an HTTPS METAGOV_STATE_URL. Sample files and services/metagov/README.md document this. Deploy the two consumers together. No actual secret/configuration was changed here.
2. Verify hosted public page/SSR/media behavior, real wallet signing, Mini App token audience on the deployed host, anonymous denial, storage bucket policies, and CDN headers after an authorized release. Those provider/live behaviors are not established by local checks.
3. Public content, wallet addresses/votes already displayed publicly, public chain data, and browser-required asset URLs remain inspectable and collectable. Hiding API routes or CORS cannot make browser-visible content secret. Existing intentionally public moderated community intake and bounded public reads remain available.
4. Process-local rate limits are defense in depth, not a distributed quota or spending cap. Signed uploads authenticate a wallet; they do not establish membership or solve paid-provider abuse by many wallets. Provider billing/quota controls and key restrictions were not audited or changed.
5. This was scoped source review plus local negative tests, not a comprehensive penetration test, historical credential audit, provider-permission audit or guarantee of no vulnerabilities.
6. Rollback should restore paired server/client auth changes together. Do not roll back to anonymous raw-state exposure; keep that route blocked at the service boundary if rolling back its consumer.

Applied secure-app-baseline controls: C01/C02 credential boundaries, C05 validation, C06/C07 endpoint/resource authorization, C08 bounded authentication abuse checks, C13 no CORS-as-auth assumptions, C20 scoped media delivery, C22 safe failures, C28 existing headers, C30 local adversarial tests plus SSRF controls. No password, payment, OAuth callback, database-policy migration, model-tool or backup/restore implementation was in scope.

## Sources and prompt

- executed-prompt.md records the repository-specific prompt and refinement process.
- Local source and tests listed above are primary evidence for implementation results.
- https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html
- https://github.com/farcasterxyz/protocol/discussions/231 and the installed @farcaster/quick-auth 0.0.6 source define the token contract used here.

Vault source notes, .obsidian, plugin configuration, imported notes, automation state and memory were not edited. Relevant memory was read for existing wallet/admin architecture and then verified in current source.
