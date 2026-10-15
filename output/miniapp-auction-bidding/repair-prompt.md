# Farcaster miniapp auction bidding repair prompt

Diagnose and resolve auction bidding in `[local path redacted] Web bidding works, but in the Farcaster miniapp entering a bid and clicking Place bid leaves a grey button with no visible result.

Follow the supplied personal instructions and the installed Agent Skills debugging workflow. Inspect the current repository and preserve all unrelated dirty files. Use the existing Next.js Pages Router, React 18, Wagmi 0.12.19, ethers v5/v6 packages and Farcaster SDK 0.3.0; do not migrate or add dependencies.

Trace `components/Hero/PlaceBid.tsx`, `hooks/useMiniAppWalletConnect.ts`, `configs/farcaster-mini-app-connector.ts`, the SDK provider adapter and the installed Wagmi preparation/submission implementation. Compare browser connectors with the Farcaster connector. Investigate connection-only clicks, signer compatibility, gas preparation, Base network enforcement, stale debounced input, wallet rejection, pending confirmation and missing error feedback. Check official provider documentation where needed.

Reproduce the root cause using the actual installed wallet libraries and a synthetic EIP-1193 provider. Write a regression test that fails before the fix. Make the smallest coherent repair while preserving the auction contract, Base chain, referral recipient, bid amount, comment calldata, minimum-bid validation and user-controlled approval.

Acceptance criteria:
- The Farcaster connector supports the installed Wagmi transaction preparation and submission interfaces.
- A disconnected click shows connection progress and explains the next step; connection is never silently treated as submission.
- Preparation failures, wallet rejection, submission failure and confirmation failure are visible and recoverable.
- The UI distinguishes wallet approval from receipt confirmation, prevents duplicate submissions and cannot submit stale input.
- No automatic fallback can submit a second transaction after an ambiguous result.
- Tests exercise connector compatibility and exact synthetic transaction payloads, wrong-chain rejection and bid UI states; existing bid-comment and wallet-runtime checks remain passing.
- Run the repository test suite, typecheck, lint and build where possible. Document environmental limits and distinguish simulated evidence from actual Farcaster host behavior.

Deliver the local fix, tests and a concise diagnosis/verification report in `output/miniapp-auction-bidding/`. Do not commit, push, deploy, alter live provider settings, sign, send real bids, move funds, expose secrets or modify memory. A real Farcaster approval/transaction remains a user-run release check.
