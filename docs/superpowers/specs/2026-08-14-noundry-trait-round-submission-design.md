# Noundry Trait Round Submission Design

## Goal

Make a Noundry gallery trait sufficient on its own for submission to an eligible Round. The submission modal must show six previews that use the trait and six collection-randomized previews, with at least one randomized preview visibly using the submitted trait. A successful Round submission must link back to the trait-specific Noundry gallery page.

## Scope

This change covers the `Submit trait to a round` modal on the trait-specific Noundry page and the server path that creates a Round trait submission. The main trait page keeps its existing eight `Generated with this trait` and eight `Randomized from the collection` previews, along with its remix workflow.

Ordinary project submissions, the main Noundry gallery, and unrelated Round behavior remain unchanged.

## Modal Preview Sets

The Round submission modal will render two sets:

- `Generated with this trait`: exactly six deterministic character generations. Every tile renders the submitted pixel trait, while all other eligible collection layers are generated from stable seeds.
- `Randomized from the collection`: exactly six deterministic character generations. At least one fixed tile renders the submitted pixel trait; the other five remain collection-randomized and do not force the trait.

The preview-grid component will accept the indexes that should render the submitted pixel layer. This lets the randomized grid visibly include the trait in only the guaranteed tile without treating every randomized tile as trait-locked.

Stable seeds will preserve the existing deterministic preview behavior across rerenders. The main trait page's existing eight-plus-eight preview sets will not change.

## Submission Data Flow

The browser will submit the canonical Noundry trait identifier and, only when the user entered non-whitespace text, an optional description. The browser will not supply an image, caption, project URL, title, or other supplemental content.

The signed request and JSON body must contain identical fields. The server will use the trait identifier and selected Round slug to load and verify the approved trait and Round, confirm that the connected wallet created the trait, and derive the remaining Round submission data:

- Title from the canonical Noundry trait record.
- Description from the optional user text or a server-generated fallback.
- Preview image from the canonical pixel data.
- Submission type and source metadata identifying a Noundry trait.
- Canonical link `/noundry/traits/{traitId}`.

The persisted Round submission will continue to identify both the selected Round and the canonical Noundry trait through the existing `round_id`, `trait_id`, `trait_type`, `submission_type`, `source`, and source-payload fields.

## Optional Text and Validation

The modal description control remains optional and is labeled accordingly. Omitting it must never block submission.

When no description is provided, the server will generate a deterministic Noundry description that fits the selected Round's configured minimum and maximum description lengths. The server will likewise normalize its derived title to the Round's configured title bounds without requiring user input.

Generic project-submission validation remains unchanged. The trusted, server-generated Noundry preview image will be accepted only in the specialized trait-submission path. Arbitrary SVG data-image input will not be enabled globally.

## Canonical Noundry Link

Every created Round trait submission will persist `/noundry/traits/{traitId}` as its URL. The Round submission detail already renders trait URLs under the label `Noundry trait page`; this behavior will be retained and covered by tests.

Following that link opens the trait-specific Noundry page, where users can see the full eight-plus-eight preview sets and use the existing remix control to fork and modify the trait.

## Error Handling

The server will continue to reject missing or unknown trait identifiers, ineligible Rounds, non-creators, duplicate submissions, closed submission periods, and wallet submission-limit violations with the existing error flow.

The current `Image must be a valid URL.` failure will be removed for canonical Noundry trait submissions by handling their internally generated preview format inside the trusted trait path. It will remain applicable to invalid image input in ordinary project submissions.

## Testing

Tests will follow the repository's existing Node test style and cover:

- Exactly six modal generations that all visibly use the submitted trait.
- Exactly six modal collection generations.
- At least one collection generation visibly using the submitted trait.
- Stable randomization for the remaining collection generations.
- A blank description producing a valid server-side fallback rather than a validation error.
- No client requirement or payload field for an additional image, caption, URL, title, or text.
- Acceptance of the trusted server-generated Noundry preview without permitting arbitrary SVG data images globally.
- Correct Round and trait identity in the persisted submission path.
- Persistence and display of `/noundry/traits/{traitId}` as the `Noundry trait page` link.
- The main trait page retaining its existing eight-plus-eight preview sets and remix behavior.

Verification will run focused tests first, followed by the full test suite, lint, and TypeScript checks.

## Acceptance Criteria

- The Round submission modal shows six `Generated with this trait` previews and six `Randomized from the collection` previews.
- Every generated-with-trait preview visibly contains the submitted trait.
- At least one randomized collection preview visibly contains the submitted trait.
- The remaining randomized previews preserve the existing deterministic collection-randomization behavior.
- A user can submit using only the canonical trait and selected Round.
- Blank optional text and absent supplemental images do not trigger validation failures.
- The submission no longer fails with `Image must be a valid URL.` for the internally generated Noundry preview.
- The created Round submission correctly identifies its Round and Noundry trait.
- The Round submission exposes a working link to `/noundry/traits/{traitId}`.
- The trait-specific Noundry page remains at eight-plus-eight previews and retains its remix workflow.
- Focused and repository-wide automated checks pass.
