# Independent findings review

Read-only local artifact review. No network, credentials, or production state accessed. Main investigator owns recommendations and report changes.

## Concrete correction

F01's control-inference wording in `build-report.cjs` and generated findings says “direct gifts and supportive ballots are proven.” Receipts establish **direct transfers**, not that they were gifts. Replace “direct gifts” with “direct transfers”; gift, sale, or custody explanations remain unresolved. This correction does not change the review recommendation.

## Independently verified

- All 219 allocation IDs, submission IDs, voter addresses and counts in `proposed-moderation.json` exactly match the final database snapshot.
- Current allocations sum to 2,919 votes. Five HIGH allocations sum to 125; all 16 reviewed allocations sum to 349.
- Snapshot `getVotes`, capacity and actual use reconcile across all 43 participants against saved successful historical calls. No per-entry cap violations, same-address self-votes, unavailable target rows, or wallet-budget violations were found.
- Independently computed final tally matches the report and all ten stored winner records.
- All six ranking scenarios and their positional award values independently recompute without mismatch. Acute 125 removal puts Fire Safety first at 334, Candleman second at 325, Rise third at 277; Tattoo falls to 14th at 84, Pirate enters 10th at 125.
- Saved successful verified/repaired receipts all have success status and matching transaction/receipt block numbers. Direct F01/F02/F04 histories have receipt coverage for all linked transactions; supporting F03/F05 old mint/acquisition edges retain explicitly labeled indexer-only records. These limits are represented in the report and do not undermine verified critical transfer/delegation events.
- Conditional capacity arithmetic is correct: Rise 304 vs consolidated 104, used 201 vs 104; Candle's 1bae+3b has zero extra aggregate capacity, while including cba yields 202 vs 102; Tattoo 303 vs 103 but used only 50; NFT355 pair 202 vs 102. These are counterfactual scenarios contingent on common control, not proven excess votes.
- The recommendation specifies no removals or disqualifications, treats common control and deliberate intent as unresolved, and labels removal scenarios conditional. It avoids treating transfers, delegated-only eligibility, or coordinated support as automatic violations.
- The report correctly distinguishes historical delegated eligibility from ownership; later NFT955/959 acquisitions do not establish snapshot eligibility. It correctly states that frozen winners require separate reconciliation after any later authorized moderation.

## Evidence limits retained

This verifies internal artifact consistency and saved chain evidence, not a new live database or RPC query. External published rules, beneficial control, full normal vote-increment history, and complete wallet-specific checkpoint logs remain unresolved as documented. No grounds were found in this independent review for stronger removal or disqualification recommendations.
