# Repair remaining Farcaster mobile bid preparation failure

In `[local path redacted] diagnose and resolve the remaining auction bidding failure on Farcaster mobile. The first fix corrected ethers v5/v6 compatibility and exposed errors, but the mobile user still sees "Unable to prepare this bid. Check your Base balance, network and the latest minimum bid, then try again." The user has checked all three conditions.

Use the existing Agent Skills debugging workflow and Web3 integration security baseline. Inspect actual installed Wagmi 0.12.19, ethers v5, the Farcaster SDK 0.3.0 provider bridge, bid preparation/submission and the voting modal's native provider integration. Preserve unrelated dirty files and the current video-preview branch. Do not migrate dependencies.

Treat the displayed text as a generic preparation failure, not evidence that the user's funds, network or minimum bid is wrong. Compare wallet-side gas estimation with the native EIP-1193 transaction request. Test a provider that connects and accepts a transaction request but rejects gas estimation. Verify SDK documentation, and separate observed repository/test facts from the unobserved raw mobile error.

Implement a single deterministic submission route for the active Farcaster connector if preparation is an unnecessary blocker: validate a fresh connected account and Base chain, validate the exact auction target/value/calldata, then request the transaction through that connector's SDK provider. Keep the browser preparation flow. Let the user control wallet approval and let the wallet handle its own gas/fee preview. Do not invent fixed gas or fees, bypass wallet checks, automatically submit after connection, or try a second sending method after an ambiguous result.

Preserve minimum/invalid/stale-input validation, the createBidWithReferral call, referral address, token ID and optional UTF-8 comment. Preserve progress/error UI, receipt polling on Base, confirmation truth and duplicate-send protection. Recognized rejection permits deliberate retry; a send attempt with missing or unknown outcome requires checking wallet activity before another attempt. Surface sanitized error codes for otherwise generic failures without exposing raw provider payloads.

Add regression tests that fail before the fix and cover active Farcaster versus other connectors, an unavailable gas estimate, exact native payload, account/chain mismatch, rejection/retry, duplicate clicks, receipt failure and invalid/unknown transaction responses. Run focused tests, full suite, typecheck, lint and build. Save a concise evidence report and explicitly distinguish synthetic checks from a real Farcaster mobile approval test.

Scope: local code and tests only. Do not commit, push, deploy, change provider settings, sign or send real bids without separate authorization for this follow-up. Prior authorization to publish the first repair does not authorize publication of new work.
