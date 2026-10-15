---
name: round-voting-audit
description: Audit completed Yellow Collective voting rounds for self-voting, wallet coordination signals, NFT transfers, and delegation. Use at round close or when a round's ballots are questioned. Audits are read-only and do not authorize moderation.
---

# Round Voting Audit

Use for an end-of-voting audit of any Yellow Collective round. Take a supplied round slug or ID; if omitted, identify closed production rounds and proceed only if the intended round is unambiguous. Suspicion is a lead, not a conclusion.

## Production data

The verified live Railway PostgreSQL is BuilderOS production: project af512d4f-60b5-42a8-b7dc-bf337fa00c1d, Postgres service 9472c187-a023-46d2-b39e-4f42a88d3b51, database railway, host gondola.proxy.rlwy.net. Reconfirm identity every run; stop on mismatch. Never substitute local/demo data.

When the user asks you to audit a round, run the included collector yourself through Railway CLI with explicit project, production environment and service IDs. The user does not need to run this command. Use the supplied round slug or ID; if the target is unclear, ask which round before collecting data.

    railway run --project af512d4f-60b5-42a8-b7dc-bf337fa00c1d --environment production --service 9472c187-a023-46d2-b39e-4f42a88d3b51 --no-local -- node .agents/skills/round-voting-audit/scripts/collect-round-audit.cjs --round <slug-or-id>

The collector checks the DB host/name and read-only transaction, uses repeatable-read, then rolls back. It writes a unique snapshot folder under output/audits. Never print/read credentials, use Railway variable-list output, or call app/API GET endpoints: app routes may migrate, backfill, close rounds or write snapshots. If Railway CLI authentication or project access is unavailable, report that the audit is blocked on Railway access and identify the needed sign-in/access step; do not tell the user to run the collector manually unless they must restore their Railway CLI login. Never ask them to paste secrets. Do not use .env.local as a fallback.

## Audit

1. Verify round identity and that voting ended at the DB snapshot cutoff. Reconcile vote rows to same-round submissions; count entries, rows, voters and allocated votes. Check orphan/deleted/pending records and stored winners, awards, moderation history.
2. Compare every voter’s cross-round ballots with submitters and every entry they submitted. Count votes/rounds/entries per submitter. Flag direct self-votes, sole-support patterns, repeated pairs, new or high-budget wallets, suspicious timing, transfers, and delegations as separate leads.
3. Confirm current repository voting rules, chain and NFT contract. Inspect Base Transfer and delegation events for candidate voters, submitters and linked wallets. Compare blocks/timestamps with eligibility snapshots and ballots. Use historical owner, balance, voting-power and delegate reads where available. Verify material receipts and cite explorer links. Record source, block/pagination coverage and failures.
4. Keep OBSERVED, INFERRED and UNKNOWN distinct. A wallet is not a person; vote patterns, gifts/sales/custody, NFT transfers, funding, public profiles and delegation do not alone prove common control or intent. Partial history cannot prove absence.
5. Write a short decision-first report and evidence appendix in a new UTC-timestamped output/audits folder. Link candidate Yellow profiles and BaseScan addresses. Give per-wallet votes for own/submitted entries and who controls the wallet only when evidence supports it; otherwise say Owner unknown. Include alternative explanations, next evidence needed, and conditional winner shifts when relevant.

Read references/evidence-policy.md for evidence labels, coverage and report conventions. Preserve old audit folders and unrelated work.

## Scope boundary

Recommend human review only. Do not change votes, rankings, winners, awards or user accounts; disqualify or contact submitters; sign; send transactions; or write to production. Those require separate explicit authorization.
