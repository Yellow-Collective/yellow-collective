# Noundry Trait Round Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a canonical Noundry trait sufficient for Round submission while showing six trait generations and six collection generations, including the trait in at least one collection tile, and preserving a link back to the full trait page.

**Architecture:** Add a pure Noundry helper that owns modal preview counts, deterministic seed construction, edited-tile indexes, bounded server-derived text, and safe SVG attribute escaping. The trait page consumes the preview helper and sends only a trait ID plus optional trimmed description. The specialized server path derives and persists all other fields, validates trusted generated content without weakening ordinary project URL validation, and retains the canonical trait-page link.

**Tech Stack:** Next.js 15 pages router, React 18, TypeScript, Node `assert` tests with TypeScript transpilation through the repository's installed compiler, PostgreSQL persistence.

## Global Constraints

- The 6+6 preview change applies only to the `Submit trait to a round` modal.
- The trait-specific Noundry page remains at eight generated-with-trait plus eight collection-randomized previews.
- Exactly six modal generated previews visibly contain the submitted trait.
- Exactly six modal collection previews render, and at least one visibly contains the submitted trait.
- The trait and selected Round are sufficient; supplemental image and text input are not required.
- Arbitrary SVG data images must remain rejected by the generic URL-safety helper.
- Every Round trait submission persists `/noundry/traits/{traitId}` and exposes it as `Noundry trait page`.
- Ordinary project-submission behavior remains unchanged.

---

## File Map

- Create `utils/noundry/round-trait-submission.ts`: pure preview-plan construction, bounded fallback text, and SVG attribute escaping.
- Create `tests/noundry-trait-round-submission.test.mjs`: behavioral tests for the pure helper plus focused source-integration assertions.
- Modify `pages/noundry/traits/[id].tsx`: consume the preview plan, render per-tile submitted-trait overlays, label the description optional, and omit blank descriptions from the signed payload.
- Modify `data/rounds.ts`: derive bounded title/description, safely generate the trusted trait preview, use specialized validation, and persist the canonical trait link.
- Modify `pages/rounds/[slug].tsx`: retain the existing canonical trait link presentation; change only if the focused test exposes a missing navigation path.
- Modify `package.json`: add the focused test to the repository test script.

### Task 1: Build and Integrate the Modal Preview Plan

**Files:**
- Create: `utils/noundry/round-trait-submission.ts`
- Create: `tests/noundry-trait-round-submission.test.mjs`
- Modify: `pages/noundry/traits/[id].tsx`

**Interfaces:**
- Produces: `buildRoundTraitModalPreviewPlan<T>(options): RoundTraitModalPreviewPlan<T>`.
- Produces: `ROUND_TRAIT_MODAL_PREVIEW_COUNT` with the exact value `6`.
- Produces: generated and collection trait arrays plus `generatedEditedIndexes` and `collectionEditedIndexes`.
- Consumes: the existing `buildRandomTraits(artwork, seed, overrides)` function through an injected callback so the helper stays pure and independently testable.

- [ ] **Step 1: Write the failing preview-plan tests**

Add a TypeScript loader like the one in `tests/round-image-upload.test.mjs`, load `utils/noundry/round-trait-submission.ts`, and add these behavioral assertions:

```js
test("builds six trait generations and six collection generations", () => {
  const calls = [];
  const plan = helper.buildRoundTraitModalPreviewPlan({
    seedPrefix: "trait-123",
    submittedTraitOverride: { heads: "custom" },
    buildTraits: (seed, overrides) => {
      calls.push({ seed, overrides });
      return { seed, ...overrides };
    },
  });

  assert.equal(plan.generatedTraits.length, 6);
  assert.equal(plan.collectionTraits.length, 6);
  assert.deepEqual(Array.from(plan.generatedEditedIndexes), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from(plan.collectionEditedIndexes), [0]);
  assert.equal(calls.length, 12);
});

test("forces the submitted trait into every generated tile and one collection tile", () => {
  const calls = [];
  helper.buildRoundTraitModalPreviewPlan({
    seedPrefix: "trait-123",
    submittedTraitOverride: { heads: "custom" },
    buildTraits: (seed, overrides) => {
      calls.push({ seed, overrides });
      return overrides;
    },
  });

  assert.equal(calls.slice(0, 6).every(({ overrides }) => overrides.heads === "custom"), true);
  assert.equal(calls.slice(6).filter(({ overrides }) => overrides.heads === "custom").length, 1);
  assert.equal(calls.slice(7).every(({ overrides }) => Object.keys(overrides).length === 0), true);
});

test("uses stable and distinct seeds for both preview sets", () => {
  const seeds = [];
  helper.buildRoundTraitModalPreviewPlan({
    seedPrefix: "trait-123",
    submittedTraitOverride: { heads: "custom" },
    buildTraits: (seed) => {
      seeds.push(seed);
      return { seed };
    },
  });

  assert.equal(new Set(seeds).size, 12);
  assert.equal(seeds[0], "trait-123-round-generated-0");
  assert.equal(seeds[6], "trait-123-round-collection-0");
});
```

- [ ] **Step 2: Run the focused test and verify the missing helper failure**

Run: `node tests/noundry-trait-round-submission.test.mjs`

Expected: FAIL because `utils/noundry/round-trait-submission.ts` does not exist.

- [ ] **Step 3: Implement the pure preview plan**

Create the helper with this public shape:

```ts
export const ROUND_TRAIT_MODAL_PREVIEW_COUNT = 6;

export type RoundTraitModalPreviewPlan<T> = {
  generatedTraits: T[];
  collectionTraits: T[];
  generatedEditedIndexes: number[];
  collectionEditedIndexes: number[];
};

export const buildRoundTraitModalPreviewPlan = <T>({
  seedPrefix,
  submittedTraitOverride,
  buildTraits,
}: {
  seedPrefix: string;
  submittedTraitOverride: Record<string, string>;
  buildTraits: (seed: string, overrides: Record<string, string>) => T;
}): RoundTraitModalPreviewPlan<T> => {
  const generatedEditedIndexes = Array.from(
    { length: ROUND_TRAIT_MODAL_PREVIEW_COUNT },
    (_, index) => index
  );
  const collectionEditedIndexes = [0];

  return {
    generatedTraits: generatedEditedIndexes.map((index) =>
      buildTraits(`${seedPrefix}-round-generated-${index}`, submittedTraitOverride)
    ),
    collectionTraits: generatedEditedIndexes.map((index) =>
      buildTraits(
        `${seedPrefix}-round-collection-${index}`,
        collectionEditedIndexes.includes(index) ? submittedTraitOverride : {}
      )
    ),
    generatedEditedIndexes,
    collectionEditedIndexes,
  };
};
```

- [ ] **Step 4: Integrate the plan into the submission modal**

In `SubmitTraitToRoundModal`, replace the two four-item `useMemo` blocks with one memoized call:

```ts
const previewPlan = useMemo(
  () =>
    artwork
      ? buildRoundTraitModalPreviewPlan({
          seedPrefix: submission.id,
          submittedTraitOverride: submittedTraitBase,
          buildTraits: (seed, overrides) =>
            buildRandomTraits(artwork, seed, overrides),
        })
      : {
          generatedTraits: [],
          collectionTraits: [],
          generatedEditedIndexes: [],
          collectionEditedIndexes: [],
        },
  [artwork, submission.id, submittedTraitBase]
);
```

Change `RoundTraitPreviewGrid` from a single `showEditedTrait: boolean` to `editedIndexes: number[]`, and render each tile with `showEditedTrait={editedIndexes.includes(index)}`. Pass all six generated indexes to the first grid and `[0]` to the collection grid.

- [ ] **Step 5: Run the focused test and TypeScript check**

Run: `node tests/noundry-trait-round-submission.test.mjs`

Expected: PASS for all preview-plan tests.

Run: `yarn typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit the preview work**

```bash
git add utils/noundry/round-trait-submission.ts tests/noundry-trait-round-submission.test.mjs pages/noundry/traits/[id].tsx
git commit -m "Add Noundry round preview guarantees"
```

### Task 2: Make Supplemental Text and Images Unnecessary

**Files:**
- Modify: `utils/noundry/round-trait-submission.ts`
- Modify: `tests/noundry-trait-round-submission.test.mjs`
- Modify: `pages/noundry/traits/[id].tsx`
- Modify: `data/rounds.ts`

**Interfaces:**
- Produces: `fitRoundTraitText({ value, fallback, minLength, maxLength }): string`.
- Produces: `escapeSvgAttribute(value: string): string`.
- Consumes: the canonical `NoundrySubmission`, selected `Round`, verified wallet address, and optional description already loaded by `createRoundTraitSubmission`.

- [ ] **Step 1: Write failing bounded-text and escaping tests**

```js
test("derives bounded text when optional input is blank or short", () => {
  const blank = helper.fitRoundTraitText({
    value: "   ",
    fallback: "Noundry head trait",
    minLength: 30,
    maxLength: 48,
  });
  const short = helper.fitRoundTraitText({
    value: "Nice trait",
    fallback: "Noundry head trait",
    minLength: 20,
    maxLength: 24,
  });

  assert.ok(blank.length >= 30 && blank.length <= 48);
  assert.ok(short.startsWith("Nice trait"));
  assert.ok(short.length >= 20 && short.length <= 24);
});

test("truncates derived text to the configured maximum", () => {
  assert.equal(
    helper.fitRoundTraitText({
      value: "A very long canonical Noundry trait title",
      fallback: "Noundry trait",
      minLength: 3,
      maxLength: 12,
    }),
    "A very long c"
  );
});

test("escapes every SVG attribute metacharacter in stored pixel colors", () => {
  assert.equal(
    helper.escapeSvgAttribute('red\"/><script>&\''),
    "red&quot;/&gt;&lt;script&gt;&amp;&#39;"
  );
});
```

Also add source assertions that the modal label includes `Submission description (optional)`, blank descriptions are omitted from the payload, the specialized server path persists `/noundry/traits/${trait.id}`, and generic `normalizeSafeImageUrl` still rejects SVG data images through the existing URL-safety test.

- [ ] **Step 2: Run the focused test and verify helper/copy failures**

Run: `node tests/noundry-trait-round-submission.test.mjs`

Expected: FAIL because the text and escaping exports and optional label do not exist.

- [ ] **Step 3: Implement deterministic bounded text and SVG escaping**

Add pure helpers that:

1. Normalize bounds so `minLength` is non-negative and never above `maxLength`.
2. Prefer trimmed user text; otherwise use the trimmed fallback; otherwise use `Noundry trait`.
3. Truncate values above `maxLength`.
4. Extend values below `minLength` with repeated slices of ` Submitted from the Noundry Gallery.` until they reach the exact minimum.
5. Escape `&`, `"`, `'`, `<`, and `>` before embedding pixel colors in SVG attributes.

- [ ] **Step 4: Make the browser payload truly optional**

Update the modal label to `Submission description (optional)`. Build the payload without a description when the trimmed value is empty:

```ts
const trimmedDescription = description.trim();
const payload = {
  traitId: submission.id,
  ...(trimmedDescription ? { description: trimmedDescription } : {}),
};
```

Use this same object for the signature header and request body.

- [ ] **Step 5: Specialize canonical server derivation and validation**

In `createRoundTraitSubmission`:

- Fit the canonical trait title to `round.minTitleLength` and `round.maxTitleLength`.
- Fit the optional/fallback description to `round.minDescriptionLength` and `round.maxDescriptionLength`.
- Generate the SVG data image only from the database-backed trait pixels and escape each fill value with `escapeSvgAttribute`.
- Persist the exact internal link `/noundry/traits/${trait.id}`.
- Replace the generic image-URL validation call with a private trait-submission validator that checks the already-derived title and description bounds, checks the exact canonical internal link, and requires the trusted generated image prefix `data:image/svg+xml;base64,`.
- Keep `validateRoundSubmissionInput` and `normalizeSafeImageUrl` unchanged so user-supplied SVG data images remain invalid for ordinary submissions.

- [ ] **Step 6: Run focused validation tests**

Run: `node tests/noundry-trait-round-submission.test.mjs`

Expected: PASS.

Run: `node tests/url-safety.test.mjs`

Expected: PASS, including rejection of arbitrary SVG data-image URLs.

Run: `yarn typecheck`

Expected: PASS.

- [ ] **Step 7: Commit optional-input and server derivation work**

```bash
git add utils/noundry/round-trait-submission.ts tests/noundry-trait-round-submission.test.mjs pages/noundry/traits/[id].tsx data/rounds.ts
git commit -m "Allow canonical Noundry trait round submissions"
```

### Task 3: Lock In Navigation and Run Full Verification

**Files:**
- Modify: `tests/noundry-trait-round-submission.test.mjs`
- Modify: `pages/rounds/[slug].tsx` only if the test reveals the existing link is incomplete
- Modify: `package.json`

**Interfaces:**
- Consumes: persisted `RoundSubmission.url` equal to `/noundry/traits/{traitId}`.
- Produces: a visible `Noundry trait page` link in the Round submission detail modal.

- [ ] **Step 1: Add focused navigation and regression assertions**

Read `pages/rounds/[slug].tsx` and `pages/noundry/traits/[id].tsx` as source and assert:

```js
assert.match(roundPageSource, /submission\.submissionType === "trait"[\s\S]*?"Noundry trait page"/);
assert.match(roundPageSource, /href=\{submission\.url \|\| "#"\}/);
assert.match(traitPageSource, /Array\.from\(\{ length: 8 \}/);
assert.match(traitPageSource, /Remix in studio/);
```

Keep the assertions scoped to the relevant components so unrelated eight-item arrays do not produce false positives.

- [ ] **Step 2: Run the focused test**

Run: `node tests/noundry-trait-round-submission.test.mjs`

Expected: PASS if the existing link behavior is intact. If it fails, minimally restore `submission.url` as the anchor destination with `Noundry trait page` copy, then rerun to PASS.

- [ ] **Step 3: Add the focused test to the repository suite**

Append `node tests/noundry-trait-round-submission.test.mjs` immediately after `node tests/noundry-round-submit-dark-mode.test.mjs` in the `test` script.

- [ ] **Step 4: Run formatting and static verification**

Run: `yarn prettier --check utils/noundry/round-trait-submission.ts pages/noundry/traits/[id].tsx data/rounds.ts tests/noundry-trait-round-submission.test.mjs package.json`

Expected: PASS. If formatting fails, run the same command with `--write`, then rerun `--check`.

Run: `yarn lint`

Expected: PASS.

Run: `yarn typecheck`

Expected: PASS.

- [ ] **Step 5: Run all automated tests**

Run: `yarn test`

Expected: PASS with the new focused test included.

- [ ] **Step 6: Review the final diff for scope**

Run: `git diff --check`

Expected: no output.

Run: `git status --short`

Expected: only the plan and intended implementation/test files are modified; the pre-existing untracked `.worktrees/` directory remains untouched.

- [ ] **Step 7: Commit the test-suite integration**

```bash
git add tests/noundry-trait-round-submission.test.mjs package.json pages/rounds/[slug].tsx
git commit -m "Test Noundry trait round submission flow"
```
