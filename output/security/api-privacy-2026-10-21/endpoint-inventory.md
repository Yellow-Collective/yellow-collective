# API access inventory

88 Next.js endpoint files, plus the standalone metagov HTTP server. Public denotes data intentionally available through the website or Mini App; public content can be collected by direct requests.

| Route | Access policy | Source |
|---|---|---|
| `/api/activity` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/activity.ts` |
| `/api/admin/access` | Admin session or signed admin request; permission scoped | `pages/api/admin/access.ts` |
| `/api/admin/community-projects/[id]` | Admin session or signed admin request; permission scoped | `pages/api/admin/community-projects/[id].ts` |
| `/api/admin/community-projects` | Admin session or signed admin request; permission scoped | `pages/api/admin/community-projects/index.ts` |
| `/api/admin/gallery/[address]` | Admin session or signed admin request; permission scoped | `pages/api/admin/gallery/[address].ts` |
| `/api/admin/gallery` | Admin session or signed admin request; permission scoped | `pages/api/admin/gallery/index.ts` |
| `/api/admin/gallery/settings` | Admin session or signed admin request; permission scoped | `pages/api/admin/gallery/settings.ts` |
| `/api/admin/notifications/audience` | Admin session or signed admin request; permission scoped | `pages/api/admin/notifications/audience.ts` |
| `/api/admin/notifications/events` | Admin session or signed admin request; permission scoped | `pages/api/admin/notifications/events.ts` |
| `/api/admin/notifications/settings` | Admin session or signed admin request; permission scoped | `pages/api/admin/notifications/settings.ts` |
| `/api/admin/notifications/test` | Admin session or signed admin request; permission scoped | `pages/api/admin/notifications/test.ts` |
| `/api/admin/noundry-submissions/[id]` | Admin session or signed admin request; permission scoped | `pages/api/admin/noundry-submissions/[id].ts` |
| `/api/admin/noundry-submissions` | Admin session or signed admin request; permission scoped | `pages/api/admin/noundry-submissions/index.ts` |
| `/api/admin/nouns/settings` | Admin session or signed admin request; permission scoped | `pages/api/admin/nouns/settings.ts` |
| `/api/admin/rounds/[id]/export` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/[id]/export.ts` |
| `/api/admin/rounds/[id]/submissions/[submissionId]/video` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/[id]/submissions/[submissionId]/video.ts` |
| `/api/admin/rounds/[id]/submissions/[submissionId]` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/[id]/submissions/[submissionId].ts` |
| `/api/admin/rounds/[id]/submissions/export` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/[id]/submissions/export.ts` |
| `/api/admin/rounds/[id]/submissions` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/[id]/submissions/index.ts` |
| `/api/admin/rounds/[id]/votes/[voteId]` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/[id]/votes/[voteId].ts` |
| `/api/admin/rounds/[id]/votes/export` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/[id]/votes/export.ts` |
| `/api/admin/rounds/[id]/votes` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/[id]/votes/index.ts` |
| `/api/admin/rounds/[id]` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/[id].ts` |
| `/api/admin/rounds` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/index.ts` |
| `/api/admin/rounds/requests/[id]` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/requests/[id].ts` |
| `/api/admin/rounds/requests` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/requests/index.ts` |
| `/api/admin/rounds/settings` | Admin session or signed admin request; permission scoped | `pages/api/admin/rounds/settings.ts` |
| `/api/admin/session` | GET requires admin session; POST requires signed admin login; DELETE only clears cookie | `pages/api/admin/session.ts` |
| `/api/admin/testing/settings` | Admin session or signed admin request; permission scoped | `pages/api/admin/testing/settings.ts` |
| `/api/auction/[address]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/auction/[address]/index.ts` |
| `/api/auction/[address]/previous/[tokenId]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/auction/[address]/previous/[tokenId].ts` |
| `/api/auth/nonce` | Public challenge issuance; bounded input and process-local rate limit | `pages/api/auth/nonce.ts` |
| `/api/coins` | Signed wallet action; server-derived identity and resource authorization | `pages/api/coins/index.ts` |
| `/api/community/submit` | Intentionally public moderated intake; validation and process-local rate limit; echoes only submitted project | `pages/api/community/submit.ts` |
| `/api/dashboard` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/dashboard.ts` |
| `/api/ens/address/[ensName]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/ens/address/[ensName].ts` |
| `/api/ens/avatar/[address]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/ens/avatar/[address].ts` |
| `/api/ens/name/[address]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/ens/name/[address].ts` |
| `/api/ens/names` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/ens/names.ts` |
| `/api/gallery/settings` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/gallery/settings.ts` |
| `/api/governor/[address]/current-threshold` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/governor/[address]/current-threshold.ts` |
| `/api/governor/[address]/proposals/[proposalId]/votes` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/governor/[address]/proposals/[proposalId]/votes.ts` |
| `/api/governor/[address]/proposals` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/governor/[address]/proposals.ts` |
| `/api/manager/addresses/[address]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/manager/addresses/[address].ts` |
| `/api/members` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/members.ts` |
| `/api/metagov/nouns/[proposalNumber]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/metagov/nouns/[proposalNumber].ts` |
| `/api/metagov/snapshot/nouns/[proposalNumber]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/metagov/snapshot/nouns/[proposalNumber].ts` |
| `/api/metagov/snapshot/vote` | Verified Snapshot typed signature and holder eligibility | `pages/api/metagov/snapshot/vote.ts` |
| `/api/miniapp/users` | Verified Farcaster Quick Auth FID; no public data listing | `pages/api/miniapp/users.ts` |
| `/api/notifications/poll` | Cron bearer secret; notification test also permits authorized administrator | `pages/api/notifications/poll.ts` |
| `/api/notifications/proposal-29-ending-24h` | Cron bearer secret; notification test also permits authorized administrator | `pages/api/notifications/proposal-29-ending-24h.ts` |
| `/api/notifications/settings` | Cron bearer secret; notification test also permits authorized administrator | `pages/api/notifications/settings.ts` |
| `/api/notifications/test` | Cron bearer secret; notification test also permits authorized administrator | `pages/api/notifications/test.ts` |
| `/api/noundry/submissions/[id]` | Signed wallet action; server-derived identity and resource authorization | `pages/api/noundry/submissions/[id].ts` |
| `/api/noundry/submissions` | Approved gallery GET; POST requires signed artist wallet | `pages/api/noundry/submissions.ts` |
| `/api/nouns/balance/[user]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/nouns/balance/[user].ts` |
| `/api/nouns/proposals/[proposalNumber]/votes` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/nouns/proposals/[proposalNumber]/votes.ts` |
| `/api/nouns/settings` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/nouns/settings.ts` |
| `/api/pinata/upload-url` | Signed wallet upload request; short-lived upload capability only | `pages/api/pinata/upload-url.ts` |
| `/api/pinata/upload` | Signed wallet upload request; short-lived upload capability only | `pages/api/pinata/upload.ts` |
| `/api/playground/artwork` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/playground/artwork.ts` |
| `/api/playground/trait-assets` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/playground/trait-assets.ts` |
| `/api/probe/tokens` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/probe/tokens.ts` |
| `/api/profile/[address]` | Public normalized profile GET; signed owner PUT | `pages/api/profile/[address].ts` |
| `/api/propdates/[proposalId]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/propdates/[proposalId].ts` |
| `/api/rounds/[slug]/asset` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/rounds/[slug]/asset.ts` |
| `/api/rounds/[slug]/media` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/rounds/[slug]/media.ts` |
| `/api/rounds/[slug]/standings` | Intentionally public aggregate counts for active published rounds; SELECT-only, no-store, no voter identities or media | `pages/api/rounds/[slug]/standings.ts` |
| `/api/rounds/[slug]/my-submissions` | Signed owner; wallet derived on server | `pages/api/rounds/[slug]/my-submissions.ts` |
| `/api/rounds/[slug]/submissions/[submissionId]/edit` | Signed owner; wallet derived on server | `pages/api/rounds/[slug]/submissions/[submissionId]/edit.ts` |
| `/api/rounds/[slug]/submissions/[submissionId]/votes` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/rounds/[slug]/submissions/[submissionId]/votes.ts` |
| `/api/rounds/[slug]/submit-trait` | Signed wallet action; server-derived identity and resource authorization | `pages/api/rounds/[slug]/submit-trait.ts` |
| `/api/rounds/[slug]/submit` | Signed wallet action; server-derived identity and resource authorization | `pages/api/rounds/[slug]/submit.ts` |
| `/api/rounds/[slug]/video-playback` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/rounds/[slug]/video-playback.ts` |
| `/api/rounds/[slug]/videos` | Public enabled flag GET; signed owner video reservation/finalize/cancel POST | `pages/api/rounds/[slug]/videos.ts` |
| `/api/rounds/[slug]/vote` | Signed wallet vote; eligibility and limits enforced server-side | `pages/api/rounds/[slug]/vote.ts` |
| `/api/rounds/[slug]/voting-power` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/rounds/[slug]/voting-power.ts` |
| `/api/rounds/[slug]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/rounds/[slug].ts` |
| `/api/rounds/eligible-trait-rounds` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/rounds/eligible-trait-rounds.ts` |
| `/api/rounds` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/rounds/index.ts` |
| `/api/rounds/request` | Signed wallet action; server-derived identity and resource authorization | `pages/api/rounds/request.ts` |
| `/api/rounds/settings` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/rounds/settings.ts` |
| `/api/theme` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/theme.ts` |
| `/api/token/[address]/[tokenid]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/token/[address]/[tokenid].ts` |
| `/api/token/[address]/balance/[user]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/token/[address]/balance/[user].ts` |
| `/api/token/[address]/governor` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/token/[address]/governor.ts` |
| `/api/token/[address]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/token/[address]/index.ts` |
| `/api/token/[address]/user-votes` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/token/[address]/user-votes.ts` |
| `/api/treasury/[address]` | Intentionally public presentation / onchain data; no privileged record listing | `pages/api/treasury/[address].tsx` |

Metagov service: GET /health exposes only {ok:true}; /state, /state-file and /state/:proposal require METAGOV_STATE_SECRET. Alternate methods return 405.
