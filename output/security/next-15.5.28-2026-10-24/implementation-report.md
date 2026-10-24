# Yellow Collective Next.js security update — 2026-10-24

Local patch applied on `main`, starting at `a4b697cb`. No commit, push, deployment, provider change, secret access/rotation, database migration, signing or transaction was performed.

## Version and file changes

| Dependency | Before | After |
| --- | --- | --- |
| Next.js | 15.5.24 | **15.5.28** |
| sharp dependency and Yarn resolution | 0.35.4 | **0.35.5** |

- `package.json`: only the three dependency/resolution values above were edited by this task. Existing and concurrent test-script changes were retained. `eslint-config-next` remains 15.5.21.
- `yarn.lock`: 37 old package entries replaced by 37 updated entries, limited to Next.js, `@next/env`, platform SWC packages, sharp and its required platform/libvips packages. libvips packages move from 1.3.3 to 1.3.4. No unrelated lock entry changed.
- `tests/next-security-regressions.test.mjs`: opt-in production fixture exercising actual Next image optimization and SSG/ISR responses without app data, local environment files or external services.
- This directory contains validation logs, the remaining advisory inventory, scope review and a local cache-cleanup script.

The sharp bump is required: the existing global 0.35.4 resolution would override Next's patched image dependency. The [upstream image advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw) requires sharp >=0.35.5; the [15.5.28 release](https://github.com/vercel/next.js/releases/tag/v15.5.28) fixes both current Next advisories.

## Review and validation

| Check | Result |
| --- | --- |
| Exact patch install, lifecycle scripts disabled | PASS |
| Fresh `yarn install --frozen-lockfile --ignore-scripts --offline` in a temporary D: source copy | PASS; lockfile matches the repository byte for byte |
| `yarn test` | PASS on the current worktree, including Rounds/media/API privacy tests |
| `yarn typecheck` | PASS |
| `yarn lint` | PASS; three existing `no-img-element` warnings and the Next lint deprecation notice |
| `node tests/next-security-regressions.test.mjs` | PASS |
| `yarn test:round-video-runtime` | PASS; real FFmpeg/ffprobe, loopback storage, immutable approved bytes, rejected codecs/replays |
| `yarn build` | PASS, 220.88 seconds; local environment files and inherited credentials excluded |
| Lockfile scope review, original dirty-file hashes, `git diff --check`, regression-script syntax | PASS |
| Docker/Linux container build | BLOCKED: Docker is unavailable |

The new regression verifies Next resolves sharp 0.35.5 or newer, PNG resizing and cache hits, SVG rejection under the current policy, unapproved image-host rejection, and distinct static/catch-all ISR content across repeated reads and revalidation. It is focused regression coverage, not an exploit reproduction or a Linux/glibc security proof. The app uses Pages Router; no App Router/Server Actions implementation was found to exercise.

The initial baseline suite failed at the API inventory assertion for `pages/api/rounds/[slug]/standings.ts`. Concurrent unrelated Rounds/API inventory work changed during this task; the final current suite passes. This task did not fix that assertion or edit Rounds/video-worker behavior. All originally modified tracked files other than the intentionally edited package manifest retained their recorded hashes.

The application build excludes inherited credentials and blocks `.env` file reads in a validation-only preload. It compiled, generated all 16 static pages and completed tracing. Missing database configuration exercised the existing homepage fallback. The repository's existing prebuild repair ran as configured. Hosted integrations with real configuration are outside this verification. The exact validation command was `node .codex-tmp/next-security/run-root-build.cjs`; copies of the wrapper and preload are included here for review.

## Advisory findings

`yarn audit --json --level info` still exits 14 because unrelated advisories remain. Summary counts include repeated dependency paths:

| Severity | Before | After |
| --- | --- | --- |
| Critical | 1 | **0** |
| High | 34 | **31** |
| Moderate | 28 | **26** |
| Low | 11 | **11** |

There are **no remaining Next.js or sharp findings at any severity**. The requested GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r, GHSA-4jqv-mc3x-m676 and GHSA-mcj8-r9mp-w47p are absent. The separate sharp finding GHSA-wq5f-xc86-pv6w is also absent.

The remaining 28 unique advisory IDs span axios, brace-expansion, follow-redirects, source-map-js, zod, postcss, decode-uri-component, postcss-selector-parser, fflate, elliptic and stream-json. High findings affect the first five of these. Exact IDs/titles are in `advisories-after.json`; full paths and ranges are in `audit-after.jsonl`. These were left unchanged; exploitability/reachability was not reassessed. The existing high-severity CI audit gate therefore remains failing.

## Manual production-verification checklist

- [ ] Identify each Vercel/Railway service actually running Next.js and inspect its deployed artifact, commit and runtime versions. Deployed versions remain **UNKNOWN**; this local patch does not update production.
- [ ] For a separately authorized release, confirm its artifact resolves Next.js 15.5.28 and sharp >=0.35.5 on the actual Linux image. Verify rebuilt native dependencies, not only the manifest.
- [ ] Build the worker container locally where Docker is available: `docker build -f workers/round-video/Dockerfile -t yellow-round-video:next-15.5.28 .`. Verify frozen installation and startup on Linux/glibc; use synthetic fixtures for video validation.
- [ ] On an authorized preview, check allowed PNG optimization/cache hits, blocked SVGs/unapproved hosts, SSG/ISR route isolation and revalidation, Rounds GIF animation, image galleries, video playback and API cache policies. Use read-only production smoke checks after a separately authorized release.
- [ ] Confirm provider logs/health for every affected service and ensure any rollback artifact also contains the security fixes. Review the remaining audit findings separately.

The Vercel CLI is unavailable in this session. For later Vercel inspection, recommended optional setup is `npm i -g vercel`; it was not run here.

## Local disk/cache follow-up

C: ran out of space during the first install. Installation recovered using the temporary cache `D:/CodexTemp/yellow-next-security-20261024-01a16e23`; no global package-manager configuration changed. A fresh source/dependency verification copy also resides under that folder.

The recovery attempt created 37 C: cache junctions, and the Windows filesystem sandbox blocks their removal with error 649. Run `cleanup-task-cache-junctions.ps1` from this directory in a normal PowerShell outside Codex. It checks exact paths and targets and removes only those task-created links, never package contents or unrelated cache entries. This cleanup has **not** been verified outside the sandbox. Until cleanup, use the direct D: cache for scoped installs in this sandbox. The script does not delete the D: cache or source copy.

Source notes, `.obsidian/`, plugin configurations, imported notes, automation state and memory were not edited. Relevant memory was read only.
