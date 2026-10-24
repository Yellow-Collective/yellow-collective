# Automatic ranking after vote removal

Implement the following in `C:/Users/Deej/Documents/GitHub/yellowcollective`:

When votes are removed, the public round page must automatically show submissions in the order of their actual current valid vote totals. This must work for closed rounds as well as future rounds, without manually editing rankings after moderation.

Inspect the repository instructions and preserve all unrelated uncommitted changes. Follow the existing Pages Router, database and test conventions. Trace the authoritative aggregate, stored winner/rank records, public API serialization, server rendering, client sorting and refresh behavior before choosing the smallest fix. Do not assume the problem is a cache issue.

Requirements:
- Default ranked results use current valid totals in descending order, with deterministic ties consistent with the existing rules.
- Existing frozen winner records cannot silently override current leaderboard order after votes change.
- Rank labels and other displayed result metadata must remain coherent with the intended current-ranking semantics. Preserve historical payment/award records; do not silently reassign settlements or paid prizes.
- Preserve moderation visibility, deleted/unapproved submission exclusions, filtering, pagination, wallet state and existing sort controls. Preserve intended submission/voting-phase behavior.
- Ensure the normal data refresh path picks up moderated totals, including a round page already open after voting closes, without adding a high-frequency query loop or broad new infrastructure.
- Fix the shared behavior for every applicable round; do not special-case `propoganda` or hardcode audited wallets/totals.
- Keep public serialization allowlists and existing auth/privacy edits intact. Do not expose raw vote or account data to fix ordering.

Execute locally, add a focused regression reproducing stale winner ordering after a vote reduction/deletion, and verify deterministic ties and the relevant refresh path. Use synthetic fixtures or mocks, not production mutations. Run existing adjacent tests and typecheck as appropriate; report exact results and any limits. No new dependencies unless necessary and justified.

Save a concise implementation report with root cause, changed files, validation commands and release status in `output/round-ranking-fix/`. This request authorizes implementation and local verification; do not deploy, push, modify production records, run migrations, or change paid awards.
