# Prompt validation

- Draft 1 preserved the requested grain: one voter, one submission, count and brief reason, ordered by confidence.
- Draft 2 added the exact saved production/evidence paths, original titles, allocation IDs, separate historical context and a production read-only boundary.
- Draft 3 challenged identity certainty, arbitrary multi-wallet deletion, selective treatment of first-place votes, cumulative timestamps and duplicate allocation rows; added policy-dependent and review-only labels.
- Final compression kept one executable prompt. The local prompt-library index and Web3 DAO Ops index were checked; none matched this specific vote-allocation synthesis, so the prompt was written for this task.

Execution: build-list.cjs joined every output row to the saved snapshot and verified row IDs, wallet/submission correspondence, counts, active approval status, round scope and uniqueness. High-confidence rows sum to 34; policy-dependent rows total 206 across 22 allocations. No production calls or writes were made during synthesis.
