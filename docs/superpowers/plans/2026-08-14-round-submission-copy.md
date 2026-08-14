# Round Submission Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace public Round “project” language with inclusive submission terminology and add Round-title-aware form placeholders without changing persisted data or internal domain identifiers.

**Architecture:** A pure `getRoundSubmissionPlaceholders(roundTitle)` helper owns all conditional placeholder copy. The submission page consumes that helper, while fixed public-page and validation strings are updated at their existing presentation boundaries.

**Tech Stack:** Next.js 15, React 18, TypeScript 5, Node.js assertion-based tests.

## Global Constraints

- Keep database fields, API properties, routes, TypeScript domain types, internal `"project"` values, and URL-normalization helper names unchanged.
- Do not infer a submission medium from free-form Round title, description, or content.
- Keep persistent labels associated with every form control.
- The generic URL placeholder must be exactly `Enter your submission URL`.
- Preserve submission validation, signing, upload, persistence, success handling, and routing behavior.

---

### Task 1: Add and integrate Round-aware submission copy

**Files:**
- Create: `utils/rounds/submission-copy.ts`
- Create: `tests/round-submission-copy.test.mjs`
- Modify: `pages/rounds/[slug]/submit.tsx`
- Modify: `pages/rounds/[slug].tsx`
- Modify: `data/rounds.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `getRoundSubmissionPlaceholders(roundTitle: string): RoundSubmissionPlaceholders`
- Produces: `RoundSubmissionPlaceholders` with `title`, `url`, `image`, and `description` string properties.
- Consumes: the existing `round.title` string supplied to the form page by `getServerSideProps`.

- [ ] **Step 1: Write the failing focused test**

Create `tests/round-submission-copy.test.mjs` using the repository's TypeScript transpilation pattern. If the helper file does not exist, fail with an assertion rather than an uncaught file error. Test the named-Round result:

```js
assert.deepEqual(
  { ...copy.getRoundSubmissionPlaceholders("  Summer Art Show  ") },
  {
    title: "Enter a submission title for Summer Art Show",
    url: "Enter your submission URL",
    image: "Enter an image URL for Summer Art Show",
    description: "Describe your submission for Summer Art Show.",
  }
);
```

Test both empty and whitespace-only titles against:

```js
{
  title: "Enter a submission title",
  url: "Enter your submission URL",
  image: "Enter an image URL",
  description: "Describe your submission for this round.",
}
```

Read `pages/rounds/[slug]/submit.tsx`, `pages/rounds/[slug].tsx`, and `data/rounds.ts` as source. Assert that the form imports and calls `getRoundSubmissionPlaceholders(round.title)`, uses each returned placeholder, retains label markup, and contains `Submission URL (optional)` and `Submit entry`. Assert that the detail page contains `Submit entry`, `Submission link`, `Submissions`, and `Submission submitted`. Assert that validation contains `Submission URL must be a valid URL.` Finally, assert that scoped user-facing legacy literals (`Project URL`, `Submit project`, `Project link`, `Projects`, and `Project submitted`) are absent while making no assertion against lowercase internal `project` identifiers.

Add `node tests/round-submission-copy.test.mjs` to the `test` script immediately after the other Round form tests.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node tests/round-submission-copy.test.mjs
```

Expected: FAIL with the explicit assertion that `utils/rounds/submission-copy.ts` is missing and/or assertions showing the old public copy is still present.

- [ ] **Step 3: Implement the minimal placeholder helper**

Create `utils/rounds/submission-copy.ts`:

```ts
export type RoundSubmissionPlaceholders = {
  title: string;
  url: string;
  image: string;
  description: string;
};

export const getRoundSubmissionPlaceholders = (
  roundTitle: string
): RoundSubmissionPlaceholders => {
  const title = roundTitle.trim();

  return {
    title: title
      ? `Enter a submission title for ${title}`
      : "Enter a submission title",
    url: "Enter your submission URL",
    image: title ? `Enter an image URL for ${title}` : "Enter an image URL",
    description: title
      ? `Describe your submission for ${title}.`
      : "Describe your submission for this round.",
  };
};
```

- [ ] **Step 4: Integrate the helper and replace scoped user-facing copy**

In `pages/rounds/[slug]/submit.tsx`, import the helper, compute:

```ts
const placeholders = getRoundSubmissionPlaceholders(round.title);
```

Use `placeholders.title`, `.url`, `.image`, and `.description` in the existing labeled controls. Replace the URL label with `Submission URL (optional)` and the ordinary CTA with `Submit entry`.

In `pages/rounds/[slug].tsx`, replace only ordinary public submission literals:

```text
Submit project     -> Submit entry
Project link       -> Submission link
Projects           -> Submissions
Project submitted  -> Submission submitted
```

Keep Noundry trait labels unchanged. In `data/rounds.ts`, change only the validation message to `Submission URL must be a valid URL.`

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
node tests/round-submission-copy.test.mjs
```

Expected: all focused tests print `ok` and the process exits 0.

- [ ] **Step 6: Refactor without changing behavior**

Review the helper and integration for duplicated placeholder construction or copy conditionals. Keep all title-dependent placeholder logic inside `utils/rounds/submission-copy.ts`; retain fixed page copy in its existing components. Re-run the focused test and expect exit 0.

---

### Task 2: Verify the complete change

**Files:**
- Verify: `utils/rounds/submission-copy.ts`
- Verify: `tests/round-submission-copy.test.mjs`
- Verify: `pages/rounds/[slug]/submit.tsx`
- Verify: `pages/rounds/[slug].tsx`
- Verify: `data/rounds.ts`
- Verify: `package.json`

**Interfaces:**
- Consumes: the completed helper and copy integration from Task 1.
- Produces: verification evidence that the existing project behavior remains healthy.

- [ ] **Step 1: Run the full automated test suite**

Run:

```bash
yarn test
```

Expected: every test, including `round-submission-copy.test.mjs`, passes with exit 0.

- [ ] **Step 2: Run lint**

Run:

```bash
yarn lint
```

Expected: exit 0 with no new warnings or errors caused by this change.

- [ ] **Step 3: Run the TypeScript compiler**

Run:

```bash
yarn typecheck
```

Expected: exit 0 with no type errors.

- [ ] **Step 4: Inspect the final diff and copy audit**

Run:

```bash
git diff --check
git diff -- utils/rounds/submission-copy.ts tests/round-submission-copy.test.mjs 'pages/rounds/[slug]/submit.tsx' 'pages/rounds/[slug].tsx' data/rounds.ts package.json
```

Confirm that only presentation copy, the pure helper, tests, and test-script registration changed; internal `"project"` types and stored values remain untouched.

- [ ] **Step 5: Commit the implementation**

```bash
git add utils/rounds/submission-copy.ts tests/round-submission-copy.test.mjs 'pages/rounds/[slug]/submit.tsx' 'pages/rounds/[slug].tsx' data/rounds.ts package.json docs/superpowers/plans/2026-08-14-round-submission-copy.md
git commit -m "feat: clarify round submission copy"
```
