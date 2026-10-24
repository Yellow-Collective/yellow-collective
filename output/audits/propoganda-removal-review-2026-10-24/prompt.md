# Prompt — final vote-removal review list

Prepare and execute a concise, evidence-ranked review list for the closed Yellow Collective `propoganda` round. Work in `C:/Users/Deej/Documents/GitHub/yellowcollective`.

Use the saved production export `output/audits/round-propoganda-2026-10-24T01-00-53-099Z/database-snapshot.json` and the reports, Farcaster verification joins, historical comparisons and onchain evidence under `output/audits/all-voters-expanded-2026-10-24T00-59-39-194Z/`. Read the round-voting-audit skill. This is a synthesis of that dated evidence, not a claim of fresh production verification.

Produce a ranked Markdown list and CSV. Each row must contain exactly one voter, one submission, its allocated vote count, a confidence tier and one brief reason. Use exact submission titles. Link the voter to Yellow Collective and BaseScan. Keep full addresses, round/submission/allocation IDs and evidence references in the CSV/JSON. Never combine submissions or multiple voters in one row.

Rank likely self-vote candidates above behavioral leads: verified shared Farcaster account; direct financial/NFT links plus voting evidence; concentrated repeated support; coordination/timing alone. Confidence concerns the proposed self-vote or coordination explanation, not just whether a transaction exists. Clearly label unproven ownership and low-confidence rows as review only. Explain that displayed counts are existing allocations under review, not an instruction to delete every displayed vote.

Include the identified Nadiecito, Valentina, first-place supporter and coordinated-wallet leads. Preserve counterevidence, including separate Farcaster accounts and shared-service funding alternatives. For a group-level coordination concern, list affected ballot rows consistently across beneficiaries, not only the first-place entry. Treat cumulative row timestamps as allocation-record timestamps, not a complete cast-by-cast log.

Put Catra/Nounci multi-wallet ballots in a separate policy-dependent table: account links are verified, current self-votes are not established, and no arbitrary choice of a wallet or deletion quantity is justified. Keep prior-round findings as supporting evidence, not current-round deletion candidates. Exclude isolated popularity, ordinary reciprocity and sole-entry ballot matches without further evidence.

Verify every output row joins exactly one saved round vote and submission, counts match, there are no duplicate allocation IDs, high-confidence own-entry rows total 34, and no historical/removed rows enter the list. Save a short exclusion note and checks. Show a succinct result and link the complete list. Do not change production votes, rankings, moderation, accounts or source code.
