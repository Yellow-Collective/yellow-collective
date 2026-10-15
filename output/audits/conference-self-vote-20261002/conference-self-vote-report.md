# Yellow Collective Conference: self-vote review

**Finding: one clear high-priority lead, but no verifiable proof of shared ownership.**

The submitter wallet, `0xCb6Eb98D0533dd42367cd064fC5b988814187527`, did not directly vote for its own entry. One other wallet stands out: `0x9ffAab6c24d4fb58d61b26B08c8795E9E323F28B`. In the recorded round history, this wallet's only votes were for entries by the Conference submitter: 100 votes for *Yellow Flamingo*, 25 for *Simple Yellow Stickers*, 25 for *Are you winning, Son? (Yellow Collective Edition)*, and **25 for *Yellow Collective Conference***. That pattern is consistent with a side wallet, but does not prove who controlled it.

| Wallet | Conference votes | Related pattern | Assessment |
|---|---:|---|---|
| [0x9ffA…F28B](https://yellowcollective.art/profile/0x9ffAab6c24d4fb58d61b26B08c8795E9E323F28B) · [BaseScan](https://basescan.org/address/0x9ffAab6c24d4fb58d61b26B08c8795E9E323F28B) | **25** | Its four recorded ballots across three rounds all support entries submitted by `0xCb6E…7527` (175 votes total). | **Strongest side-wallet lead.** No evidence located that proves common control. |
| [0xf1f5…7Ae4](https://yellowcollective.art/profile/0xf1f5D35c46Fd62fDD9150C39acc4A1b6A8327Ae4) · [BaseScan](https://basescan.org/address/0xf1f5D35c46Fd62fDD9150C39acc4A1b6A8327Ae4) | **25** | Also voted for three other entries by the submitter, but placed votes for other creators too. Transferred NFT #355 to another Conference voter, `0x28e8…098c`. | **Weaker lead.** Shows a wallet-to-wallet relationship, not submitter ownership. |
| [0x28e8…098c](https://yellowcollective.art/profile/0x28e8292c6B21288140c5B4f16B28CEDe42E8098C) · [BaseScan](https://basescan.org/address/0x28e8292c6B21288140c5B4f16B28CEDe42E8098C) | **25** | Received NFT #355 from `0xf1f5…7Ae4` before voting. Its five ballots in this round went to different creators; no earlier round ballots were in the captured dataset. | **Unresolved.** The transfer does not tie it to the submitter. |

## Evidence limits

- The voter pattern for `0x9ffA…F28B` is unusual and directly supports the submitter's entries, but wallet activity alone cannot establish common control or intent.
- The NFT history reviewed shows token #339 reached `0x9ffA…F28B` from `0x0aa23a7e112889c965010558803813710becf263` in October 2024. No direct NFT transfer from the submitter to this wallet was found in the captured history. The submitter's observed incoming NFT #780 came from a different Safe wallet; that does not link the two.
- At the saved voting snapshot, `0x9ffA…F28B` had one NFT, one vote of voting power, and delegated to itself. Its Base transaction nonce was 5,180, so it was not a newly created wallet.
- I found no delegation event linking `0x9ffA…F28B` to the submitter in the delegation records captured for the earlier audit. This does not rule out a relationship outside that coverage.

## Recommendation

Treat `0x9ffA…F28B` as a **high-priority review lead**, not a confirmed sockpuppet. The evidence supports asking whether the submitter controlled that wallet; it does not support naming an owner, removing its votes, or disqualifying the entry by itself.

## Snapshot and access note

The vote and chain evidence here comes from the verified production snapshot taken **2026-10-01 21:00:49 UTC** (Base block **52,049,551**). A fresh live Railway read could not be completed for this follow-up: the local database URL points to `turntable.proxy.rlwy.net`, which does not contain the target records, and Railway MCP returned an authorization error. No database or onchain changes were made. The earlier snapshot's conference vote rows show **14 voters and 233 votes**.

The per-voter cross-round breakdown is in [conference-voter-patterns.json](conference-voter-patterns.json), reproducible with [derive-patterns.cjs](derive-patterns.cjs). Supporting chain and production snapshot evidence is in `comic-strips-20261001T204936Z/database-snapshot.json`, `historical-state.json`, `token-histories.json`, and `all-delegation-logs.json` in the parent audits folder.
