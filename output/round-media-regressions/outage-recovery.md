# Rounds loading outage, 2026-10-15

## Confirmed cause and data preservation

Production Vercel logs reported PostgreSQL `53300`, “sorry, too many clients already,” for `/rounds`, round detail, submission, media, voting-power and gallery-setting requests. The application returned HTTP 200 for some error pages, hiding the failure from the previous release check.

Read-only production database diagnostics confirmed 13 stored rounds and 9 active published rounds. The database connection limit was 100; a later recovery snapshot had 66 total backends, including 60 idle client connections. This snapshot is after the overload, not a measurement of its peak. No round records were deleted. The public listing recovered to 9 rounds as connection capacity recovered, before this patch was deployed.

The application used nine PostgreSQL pools without Vercel's connection-lifecycle hook. Idle timers can be suspended with server instances, leaving database connections open across deployment/traffic bursts. See [Vercel's connection-pooling guidance](https://vercel.com/kb/guide/connection-pooling-with-functions). Several modules also retained rejected initialization promises, extending a transient database failure into later requests.

## Fix

- Register all nine existing pools with `attachDatabasePool` on Vercel, keeping the existing two-connection per-pool cap and reducing idle timeout from ten to five seconds. Existing connection-string selection and SSL behavior are preserved.
- Clear failed initialization promises in settings, gallery, profiles, notifications, Noundry, community submissions and signed-request nonces. Concurrent callers still share initialization; successful initialization remains cached. Errors are rethrown, so authentication and persistence failures remain failures.
- Pin official `@vercel/functions` 3.10.1. Package identity, repository, engine and integrity were checked; installation scripts were disabled. Its idle cleanup uses the platform's request lifetime hook. No database provider, capacity, credentials or environment settings changed.
- Strengthen the release check to verify round-list data, round-detail data, submission-form data and the media API. HTTP 200 pages with error props now fail the check. Compiled GIF/video checks remain additional release indicators.

## Verification

- All nine pool factories register once and preserve the cap; synthetic PostgreSQL overload failures reject current callers and allow subsequent initialization to succeed.
- The new lifecycle test fails against the previous source and passes with the patch.
- The installed official helper is exercised with a synthetic request context, confirming that release registers an idle-timeout promise with `waitUntil`.
- Release-check tests reject HTTP 200 error pages for the listing, detail, submission form and media endpoint.
- Full test suite, TypeScript check and lint pass. Lint retains three existing image warnings.
- Dependency audit remains 29 high, 28 moderate, 11 low, zero critical advisories, matching the prior release's counts. This is an unresolved audit failure, not a passing security check.
- Production build passes with exit 0 using unavailable loopback database URLs, so static generation cannot connect to production. Post-deployment checks are recorded in the chat.

Raw diagnostic logs and counts are kept in ignored local storage. Production database access during diagnosis used read-only transactions. No database mutation, data restoration, connection termination, service restart, schema migration, vault/plugin/automation change or memory update was performed.

The Vercel connector still returns 403, but the normal authenticated Vercel CLI session works. An earlier CLI attempt used an empty custom credential directory; that was not evidence that the normal CLI session lacked credentials.
