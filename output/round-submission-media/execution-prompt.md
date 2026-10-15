# Execution prompt: round submission GIFs and admin images

Implement locally in C:/Users/Deej/Documents/GitHub/yellowcollective using the existing Next.js Pages Router, React 18, TypeScript and inline-image PostgreSQL storage. Preserve unrelated dirty work, existing cover order, traits, videos, wallet authentication, admin rounds permission and voting.

## Objective and acceptance
- Preserve uploaded GIF bytes and animation rather than drawing GIFs to a JPEG canvas. Accept PNG/JPEG/WebP as before. Limit GIF files to 1MiB, validate actual GIF content at the server boundary and show actionable errors.
- Reuse the existing ordered image picker for admin submission editing. Allow additional uploaded images/GIFs and URLs, preview pending edits, retain first-image cover and all current images until explicitly removed, persist through existing authenticated admin update.
- Enforce ten images and a 2.5MiB aggregate encoded-image budget in browser and server. Keep request bodies under 4MiB including duplicated cover and metadata; configure admin parser consistently. Preserve previously stored larger galleries when edits do not change images.
- No dependencies, schema changes, live database writes, deployment, commits, pushes or external changes.

## Plan and files
1. Add meaningful failing GIF preservation/content validation tests under tests/round-image-upload.test.mjs and admin route/update tests using synthetic fixtures.
2. Update utils/rounds/round-image-upload.ts and submission-images.ts for bounded preserved GIFs and validation; invoke validation from existing data/rounds.ts boundary.
3. Extract SubmissionImagesField from pages/rounds/[slug]/submit.tsx to components/rounds/SubmissionImagesField.tsx, reusing existing styling and field semantics. Integrate it into pages/admin/dashboard.tsx with pending state, disabled actions during processing/saving, safe preview URLs and retryable errors.
4. Configure existing admin update parser and ensure each save updates only once. Exercise authentication, wrong method, validation and successful round-scoped persistence with stubs.
5. Run node tests/round-image-upload.test.mjs, node tests/round-submission-images.test.mjs, new admin integration tests, npm test, npm run typecheck, npm run lint and npm run build. Report direct evidence and checks unavailable.

## Conventions and security
Use current named exports and double-quoted TypeScript, e.g. `export const validateRoundImageUploadFile = (file: RoundImageUploadFile) => { ... };`. Apply secure-app-baseline C05/C06/C07/C12/C19/C22: authoritative size/type validation, existing admin session and rounds permission enforcement, safe image URLs, bounded file reading and useful nonsecret errors. Public remote image URLs remain intentionally public and are not fetched server-side. No new provider integration.

## Verification boundary
Use synthetic fixtures and mocked PostgreSQL/admin auth only. Never sign or submit a wallet request, use real admin sessions, upload files to a provider, or run schema initialization against a live database. Existing images must render unchanged; browser GIF/runtime checks, database persistence and deployment remain unverified unless directly exercised in an isolated local target.

## Payload rationale
Vercel documents a 4.5MB function request/response limit: https://vercel.com/docs/functions/limitations . Inline base64 plus the legacy duplicated cover requires a smaller budget: 2.5MiB combined images and 3.75MiB including duplicated cover, with 4MiB parser limits. Metadata-only admin saves omit unchanged image bytes; exact unchanged existing galleries remain editable. Image response size remains an existing architecture limitation for large galleries.
