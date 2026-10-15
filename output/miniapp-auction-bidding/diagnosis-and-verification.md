# Farcaster auction bidding: local repair

Date: October 13, 2026. Scope: local diagnosis, implementation and synthetic verification. The live Farcaster client has not been verified with this patch.

## Diagnosis

The custom Farcaster connector returned an ethers v6 `BrowserProvider` signer to Wagmi 0.12.19, which uses ethers v5 transaction values. `PlaceBid` correctly supplies a v5 `BigNumber`. The v6 signer rejects it during gas estimation with `invalid BigNumberish value (argument="request.value", ... code=INVALID_ARGUMENT, version=6.16.0)`.

The regression test reproduced this failure using the actual installed connector and Wagmi preparation action, with a synthetic EIP-1193 provider. It failed before the repair and passed after it. No real RPC or wallet was used in that test.

This explains the reported sequence: a disconnected click only connects the wallet; the connected form then needs a prepared transaction writer. Preparation fails, the writer is absent and the button becomes disabled. The previous error formatter only inspected a small subset of preparation errors and did not render submission or confirmation failures, so the user sees no explanation.

Official documentation confirms that the [Farcaster SDK exposes an EIP-1193 provider](https://miniapps.farcaster.xyz/docs/sdk/wallet), and [ethers v5 Web3Provider accepts that provider interface](https://docs.ethers.org/v5/api/providers/other/). The installed Wagmi browser connectors also use ethers v5 Web3Provider.

## Changes

- `configs/farcaster-mini-app-connector.ts`: return an ethers v5 Web3Provider signer compatible with the installed Wagmi version.
- `hooks/useMiniAppWalletConnect.ts`: expose connection errors, clear them on retry and prevent duplicate connection attempts before React rerenders.
- `components/Hero/PlaceBid.tsx`: distinguish Connect to bid / Place bid, connection / approval / confirmation progress, preparation / submission / confirmation errors, and confirmed-but-refresh-failed results. Add preparation retry, a Base transaction link and receipt status recheck.
- `utils/auction-wallet-error.ts`: render stable, useful errors without exposing raw provider diagnostics.
- Prevent same-render duplicate bid submissions and disable stale debounced amounts, stale calldata and wrong-chain preparation. Keep submitted transactions blocked while their outcome is unknown; checking their status does not send another bid.
- Preserve the auction target, Base chain, createBidWithReferral call, referral recipient, amount, minimum-bid validation and UTF-8 comment suffix.
- `tests/miniapp-auction-bidding.test.mjs`: 11 behavioral tests covering the actual connector/Wagmi flow and the real component/hook under controlled hook results.
- `package.json`: include the new regression file in the existing test suite.
- `tests/wallet-runtime-guard.test.mjs`: let an existing source guard tolerate whitespace introduced by formatting; its requirement is unchanged.

## Verification

- `node tests/miniapp-auction-bidding.test.mjs`: 11/11 passed. See `focused-tests.log`.
- `yarn test`: full existing suite plus the new regression tests passed. See `test-suite.log`; the final additional payload-preservation test passed in the separate 11-test focused run.
- `yarn typecheck`: passed. A final check covers the last feedback-layout adjustment.
- `yarn lint`: passed with three existing img-element warnings in community pages and TokenLogo.
- `yarn build`: passed, including compilation, type/lint checks, static page generation and build tracing. The final conditional feedback-container layout was subsequently component-tested and typechecked.
- `git diff --check`: passed.
- Local production browser check at `http://localhost:3011`: entering a bid and clicking Connect to bid opened the RainbowKit wallet picker. Screenshot: `local-browser-check.png`. Wallet selection and signing were not performed. This browser check used the successful build before the final conditional feedback-container layout adjustment.
- The local server also logged an unrelated missing Nouns-balance indexer table (`ponder_live_camp.nouns`); this was outside the bid repair scope. The temporary browser tab and local server were closed after the check.

The signer regression test exercises actual installed Wagmi preparation and submission against a fake provider, verifies one send only and checks sender, destination, amount and calldata. Another test rejects the wrong chain before any send. Component tests check token/referral/comment payload construction, progress/error rendering, minimum/invalid/stale bid guards, rejection retry, receipt timeout with hash retention, and successful receipt with failed refresh. Hook tests check duplicate connections and error recovery. These are synthetic evidence, not proof of actual Farcaster host behavior.

## Recheck commands

```powershell
yarn test
yarn typecheck
yarn lint
yarn build
```

## Remaining release check

After an approved release, reopen the miniapp in Farcaster, connect the intended wallet, enter a valid current bid and verify that the wallet approval appears with the correct Base network, auction target and ETH amount. The user controls any approval. Cancelling should show a cancellation message and preserve the entered bid. If the user elects to submit a real bid, verify the Base transaction link, receipt and refreshed auction. No real bid is required for the cancellation check.

No commits, pushes, deployments, installations, provider-setting changes, signatures or real transactions were performed. Unrelated dirty work was preserved. Source notes, imported notes, .obsidian, plugin configurations, automation state and memory files were unchanged. Relevant memory was read for repository layout and source-versus-live verification limits; no memory was updated.

The executable repair brief is `repair-prompt.md` in this directory.

## Authorized publication follow-up

At the user's subsequent request, committed the seven scoped repair/test files on the existing video-preview checkout as `39247556`, then applied only that commit onto an isolated upstream/main checkout. The package.json conflict was resolved by preserving main's package configuration and adding only the bidding regression test to its test command. The four video-preview commits were excluded from publication.

Published `eee362aa25f1409a3d9131c6f636468a559c24a1` (`fix: restore Farcaster miniapp auction bidding`) to `https://github.com/Yellow-Collective/yellow-collective.git`, branch `main`. The full test suite and typecheck passed on the isolated main-based commit; see `upstream-main-tests.log`. The remote main hash was independently verified and local main aligns with upstream/main (divergence 0/0).

The original checkout remains on the video-preview branch with unrelated dirty work preserved. The clean temporary publish checkout was removed. Reports, logs and screenshots remain local and were not committed. No manual deployment or real wallet transaction was performed; live deployment and Farcaster behavior have not been verified in this publication follow-up.
