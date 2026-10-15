# Remaining Farcaster mobile bid preparation failure

October 13, 2026. Local follow-up to the published first repair. User confirmed Farcaster mobile and reported that balance, Base network and minimum bid were already checked.

## Evidence and diagnosis

FACT: The first repair fixed the ethers v5/v6 signer mismatch, but `PlaceBid` still required successful Wagmi preparation and a prepared writer before any connected wallet could submit. Installed Wagmi 0.12 preparation calls `signer.estimateGas`, which asks the wallet provider for `eth_estimateGas`. The generic message did not identify the actual wallet/RPC failure.

FACT: A synthetic provider that permits connection and native transaction requests but rejects gas estimation reproduces this failure with the actual installed connector and Wagmi preparation action. A new behavioral test failed before the follow-up: an otherwise valid connected Farcaster bid stayed disabled when preparation failed.

INFERENCE: The mobile client's preparation/estimation path is a plausible remaining cause. The user-visible error proves preparation failed; it does not establish that the balance, network or minimum bid was wrong, or prove the mobile provider rejected a particular RPC method.

UNKNOWN: The exact underlying error in the user's Farcaster mobile session was not available. No real mobile wallet approval was performed in this task. The new implementation removes the demonstrated dependency on legacy wallet-side gas preparation and provides sanitized error codes for otherwise generic failures.

The [official Farcaster wallet reference](https://miniapps.farcaster.xyz/docs/sdk/wallet) documents direct use of the SDK's EIP-1193 provider. The [wallet guide](https://miniapps.farcaster.xyz/docs/guides/wallets) documents the native wallet approval/preview flow. The installed SDK 0.3.0 forwards provider requests to the host; the existing proposal vote modal also uses native `eth_sendTransaction`. This repair preserves the repository's versions and adds no dependencies.

## Implementation

- `components/Hero/PlaceBid.tsx`: select native submission only for SDK-confirmed miniapp context with the active `farcasterMiniApp` connector. Disable legacy preparation for this route and enable a valid, current bid without requiring a prepared writer. All other connectors retain the existing prepared browser flow.
- `utils/miniapp-auction-bid.ts`: verify the provider's fresh accounts and Base chain before requesting one transaction. Use the active connector's provider, rather than discovering an unrelated wallet. Send the exact from/to/calldata/ETH value with Base chain ID. Leave gas, fees and nonce to the wallet's approval flow.
- Preserve the token ID, createBidWithReferral encoding, referral recipient, optional UTF-8 comment, minimum bid and stale-input checks. Do not submit automatically after connection.
- Preserve approval/receipt progress, Base receipt polling, transaction links, rejection handling and duplicate-click protection. A returned native hash survives a connector change. A lost or invalid send response has an unknown outcome and blocks another bid instead of falling back to a second sending route. User rejection permits deliberate retry.
- `utils/auction-wallet-error.ts`: distinguish app validation/identity failures from generic wallet/RPC failures. Append only bounded sanitized error codes; never display raw provider messages/payloads. Confirmation uncertainty is not described as a cancelled or unsent transaction.
- `tests/miniapp-auction-bidding.test.mjs`: retain the first repair's tests and extend coverage to 21 behavioral cases, including the installed SDK provider bridge.

## Verification

- Focused regression tests: 21/21 passed; `follow-up-focused.log`.
- Full repository test suite: passed with 19 follow-up cases plus all existing tests; `follow-up-suite.log`. The final additional native input-guard and installed SDK bridge cases passed in the separate 21-case run.
- `yarn typecheck`: passed.
- `yarn lint`: passed with the three pre-existing img-element warnings in community pages and TokenLogo.
- `yarn build`: passed in 172 seconds, including compilation, type/lint checks, all static pages and build tracing; `follow-up-build.log`. The initial sandbox attempt failed to spawn a build worker (`EPERM`); the retry with normal process permissions passed.
- `git diff --check`: passed.

The tests include actual installed connector/Wagmi preparation, actual connector/native submission against synthetic providers, and the SDK 0.3.0 provider bridge against a synthetic host; they do not contact a real wallet or chain. They verify exact native payload, absent wallet-side gas estimation, fresh account/network checks, rejection/retry, invalid/missing hash handling, no second send after an uncertain response, native hash retention across connector changes, and preserved browser guards.

## Release check and scope

After an approved publication, reopen the miniapp in Farcaster mobile, connect the intended wallet, enter a valid bid and tap Place bid. Verify the native wallet preview uses Base, the correct auction and the exact ETH amount. The user controls approval. Cancelling should preserve the bid and allow another deliberate attempt; this checks the approval flow without sending a real bid. If another failure appears, retain the displayed wallet code and the failing stage for a targeted follow-up.

The follow-up changes remain local and uncommitted. No push, deployment, dependency installation, provider configuration change, real signing or transaction was performed. Unrelated dirty work remains preserved. Source/imported notes, .obsidian, plugin configurations, automation state and memory were unchanged. Memory was read for verification boundaries.

Executed brief: `follow-up-repair-prompt.md`.

## Authorized publication follow-up

At the user's subsequent request, committed the four scoped fix/test files on the video-preview checkout as `16f62b16`, then applied only that change onto an isolated upstream/main checkout. The isolated test run caught a test-harness dependency-path assumption; the SDK bridge test now uses Node package resolution rather than assuming node_modules is inside the checkout. The full main-based suite (including all 21 bidding tests) and typecheck then passed. See `follow-up-upstream-main-tests.log`.

Published `1e3fddb4d2a8b9fd84511961274ee3f89fc65758` (`fix: use native Farcaster wallet approval for auction bids`) to `https://github.com/Yellow-Collective/yellow-collective.git`, branch `main`. Independently verified the remote hash and local main/upstream alignment (0/0). The video-preview commits and unrelated dirty edits were excluded. The clean temporary checkout was removed; the original checkout remains on its preview branch.

Reports and logs remain local. No manual deployment or real wallet transaction was performed. Live deployment and real Farcaster mobile approval remain unverified in this publication step.
