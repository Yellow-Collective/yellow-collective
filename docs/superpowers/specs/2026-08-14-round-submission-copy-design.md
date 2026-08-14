# Round Submission Copy Design

## Goal

Make the public Round submission journey use inclusive submission terminology and give entrants concise, Round-aware field placeholders without changing persisted data or internal domain identifiers.

## Scope

This change covers the public Round submission form, public Round detail page, and the server-side validation message returned by that form. It does not rename database columns, API properties, routes, TypeScript domain types, the internal `"project"` submission type, or URL-normalization helpers.

## Copy Rules

The submission form will keep visible, persistent labels and use the following copy:

- `Project URL (optional)` becomes `Submission URL (optional)`.
- `Submit project` becomes `Submit entry`.
- Invalid optional URLs produce `Submission URL must be a valid URL.`

The public Round detail page will use:

- `Submit entry` for the ordinary submission CTA.
- `Submission link` for an ordinary submission's external link.
- `Submissions` for the ordinary submission-type statistic.
- `Submission submitted` for ordinary submission activity.

Explicit Noundry trait terminology remains unchanged because it describes a distinct, structured submission type.

## Dynamic Placeholders

A small pure helper in `utils/rounds/` will receive the existing Round title and return all submission-form placeholders. For a Round titled `Summer Art Show`, it will return:

- Title: `Enter a submission title for Summer Art Show`
- URL: `Enter your submission URL`
- Image: `Enter an image URL for Summer Art Show`
- Description: `Describe your submission for Summer Art Show.`

The helper will trim the Round title before inserting it. If the title is empty after trimming, it will return these safe fallbacks:

- Title: `Enter a submission title`
- URL: `Enter your submission URL`
- Image: `Enter an image URL`
- Description: `Describe your submission for this round.`

The implementation will not infer artwork, video, essay, or other media from the free-form Round title, description, or content.

## Architecture and Data Flow

`pages/rounds/[slug]/submit.tsx` already receives the complete Round through server-side props. During render, it will pass `round.title` to the pure placeholder helper and use the returned strings in the existing labeled controls. No new request, state, database field, or API payload is needed.

Public Round page copy will be updated in place because these strings are fixed presentation text rather than conditional placeholder rules. The existing server validation branch will retain its logic and only change its user-facing message.

## Accessibility and Error Handling

Every control retains its persistent `<label>` and current label association. Placeholders remain supplementary hints, so the fields stay understandable after a user starts typing. Blank or whitespace-only Round titles are handled by the helper's generic fallbacks.

Existing submission validation, signing, upload, persistence, success handling, and routing behavior remain unchanged.

## Testing

Tests will follow the repository's Node test style and cover:

- Title-aware placeholders for a named Round.
- Generic placeholders for empty and whitespace-only Round titles.
- The exact URL fallback `Enter your submission URL`.
- Form integration with the placeholder helper and the new persistent copy.
- Public Round detail copy for ordinary submissions.
- The new server validation message.
- Absence of obsolete user-facing `Project` terminology in the scoped public Round journey while allowing unchanged internal identifiers.

Verification will run the focused new test first, then the full test suite, lint, and TypeScript checks defined by the project.

## Acceptance Criteria

- The entry form label reads `Submission URL (optional)`.
- Ordinary Round pages refer to entries as submissions rather than projects.
- Named Rounds produce title-aware title, image, and description placeholders.
- The URL placeholder is exactly `Enter your submission URL`.
- Empty Round titles produce clear generic fallbacks.
- Persistent labels remain present and associated with their inputs.
- Internal schemas, properties, routes, and domain values are unchanged.
- Relevant automated checks pass.
