# Farcaster verification and historical identity findings

Read-only follow-up for closed propoganda round. Retrieved October 24, 2026 UTC. Snapshot votes are from the final October 23, 21:12:26 UTC production export.

## Strongest findings

- **Nadiecito: 34 current votes from a verified second wallet to their own three entries.** Wallet [0x4e2a3a65d0e2bcdb507a70fe2d3fc5dff464aa25](https://basescan.org/address/0x4e2a3a65d0e2bcdb507a70fe2d3fc5dff464aa25) and submitter [0x215db99298af65306a4c60bd3b7612d5f60b03d7](https://basescan.org/address/0x215db99298af65306a4c60bd3b7612d5f60b03d7) share [FID 15069](https://farcaster.xyz/nadiecito.eth). Votes: TOO MUCH SLOP 15; Make Art Great Again 15; Free the DAO 4. Same second wallet gave Yellow Sunset 101 and El Heladero Pengu 101 in earlier rounds. Total retained same-account own-entry votes: **236 across three rounds**. Both wallet verification timestamps precede these votes. [Raw verification](verifications-15069.json).
- **Two Farcaster accounts each used two voting wallets this round:** Catra (FID 9318) used 036cd…bd49 and e8bb…117e for **103 combined votes**; Nounci (FID 810468) used 97c8…4665 and 3b6a…0c9a for **103 combined votes**. Neither account has a verified wallet among current submitters. This is evidence of multiple ballots linked to one account, not current self-voting. Whether that violates this round’s rules requires the rule review.
- **Pramadan’s cba18…2348 is a verified account wallet, but cast ZERO votes for Perpetual this round.** It has 120 retained historical own-account votes: Yellow Summer 80; Candleman 10; Mr. Candle 10; Yellow Frens 20. This identity link does not support removing its current votes as self-votes. [Raw verification](verifications-471160.json).
- **3b6a…0c9a belongs to the Nounci Farcaster account, not the Pramadan account in these records.** It is also Nounci’s custody address. A retained earlier ballot gave Nounci’s Yellow Meme 25 votes. A vote for another creator’s Candleman cannot by itself change this attribution. [Raw verification](verifications-810468.json).

## Seven-wallet group: verified public accounts

Each wallet below is listed by the public Farcaster client as an Ethereum verification for the named FID. Different FIDs are separate accounts, not proof of different human operators.

| Account | FID | Audited wallet | Verification timestamp UTC |
|---|---:|---|---|
| [amirk.eth](https://farcaster.xyz/amirk.eth) | 492896 | [0xdc37e6f67bfb7361e25731fc477903e172d211f1](https://basescan.org/address/0xdc37e6f67bfb7361e25731fc477903e172d211f1) | 2024-05-16T05:44:25.595Z |
| [mahnaz.eth](https://farcaster.xyz/mahnaz.eth) | 492908 | [0x0b81bffce9970aca9868120eee1bcc8de19119f7](https://basescan.org/address/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | 2024-05-12T01:18:48.763Z |
| [namirai](https://farcaster.xyz/namirai) | 814425 | [0xeb8a03b68e4f5ee0f02ff612915bfafba4902c00](https://basescan.org/address/0xeb8a03b68e4f5ee0f02ff612915bfafba4902c00) | 2024-08-02T06:53:08.037Z |
| [daving](https://farcaster.xyz/daving) | 689506 | [0x08165c34b6689a7b35ec1a57d1265f83e758240c](https://basescan.org/address/0x08165c34b6689a7b35ec1a57d1265f83e758240c) | 2024-07-30T05:08:04.719Z |
| [moonza](https://farcaster.xyz/moonza) | 847004 | [0x07566caf069465977e9b0d3a96629c73a6c69740](https://basescan.org/address/0x07566caf069465977e9b0d3a96629c73a6c69740) | 2024-09-01T21:33:32.981Z |
| [miniom](https://farcaster.xyz/miniom) | 938012 | [0xb15acc09c28226c7b47918f14951a65a0671ef3d](https://basescan.org/address/0xb15acc09c28226c7b47918f14951a65a0671ef3d) | 2025-01-06T19:08:46.996Z |
| [desdot](https://farcaster.xyz/desdot) | 815212 | [0x31475a5652efbb267b3afdd9591ef05406db792b](https://basescan.org/address/0x31475a5652efbb267b3afdd9591ef05406db792b) | 2024-08-03T10:12:02.502Z |
| [hellia.eth](https://farcaster.xyz/hellia.eth) | 792867 | [0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d](https://basescan.org/address/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | 2024-12-17T18:17:00.458Z |

All seven have separate FIDs and distinct verified wallet sets. None of their verified wallets matches any of the 18 current submitter addresses. Hellia’s verified wallet set also has no current submitter match. The outside intermediary cd295…30c1 remains unidentified.

Fname registration records predate the round: Amirk registered amirkarimi on April 19, 2024 at 20:10:48 UTC; Mahnaz registered mahnaaz at 20:19:42 UTC, 8 minutes 54 seconds later. The other group accounts have registrations in June–August 2024 or January 2025. These are registration events and prior aliases, not a complete history of ENS username changes. [Amirk registry response](fname-history-492896.json); [Mahnaz registry response](fname-history-492908.json).

## Social connections to submitters

**All seven follow Pramadan**, the Perpetual submitter. Hellia follows him too. Six of the seven follow Redykay (Daving is the exception in the returned public lists). Their social graph contains a mutually following six-account core: Amirk, Mahnaz, Namirai, Daving, Desdot and Hellia. Moonza and Miniom each follow all six. These are current following relationships and establish a social connection; they do not establish shared control, collusion, or a transaction at voting time.

| Account | Current submitter accounts followed |
|---|---|
| amirk.eth | redykay, trvkc, pramadan.eth, latif, 0xdiablo |
| mahnaz.eth | pramadan.eth, redykay, nadiecito.eth |
| namirai | trvkc, 0xdiablo, redykay, pramadan.eth |
| daving | skwalo09, pramadan.eth, nadiecito.eth |
| moonza | redykay, pramadan.eth |
| miniom | kimmydeuk, trvkc, pramadan.eth, redykay |
| desdot | pramadan.eth, redykay |
| hellia.eth | msmeghna, latif, momotsuki, trvkc, redykay, nadiecito.eth, valentinaartt, pramadan.eth, skwalo09, 0xdiablo |

## Coverage and limits

- Scope: 59 voters, 18 approved active submitter addresses, plus Hellia and cd295; **71 unique addresses** after overlap.
- Exact verification matches obtained for **36/59 voters and 12/18 submitters**; 42/71 unique addresses total. **29 remain UNKNOWN**, not “no Farcaster account.” All address-level outcomes appear in [coverage.csv](coverage.csv).
- Reverse-address lookup returned HTTP 401 authentication required. No authentication bypass, private data, or paid API was used. Candidate names came from forward-confirmed ENS/Basenames and self-supplied profile/submission URLs; candidate profiles were only attributed after exact verified address matching.
- cb6 (Support Yellow Artists), 9ffa, 7802 (We can make it!), ac1a, f7ae, 5eaa, 9234, e212 and e348 remain unidentified by Farcaster verification. Exact address web searches did not supply a verified account for cb6 or 9ffa. This is an access/discovery limit.
- Public verification responses include address, FID and verification timestamp, but **not raw verification signatures**. Timestamps predate the cited votes; current membership was verified now. Removal/re-addition and historical custody/key changes were not exhaustively replayed. No claim of continuous ownership or a real-world identity is made.
- Public follow pagination exhausted for all eight selected FIDs: 84 pages, 4073 returned users. Profile following counters are larger than the returned public lists for some accounts; results cover the returned public view, not a complete protocol history. Initial rate limits were saved, respected, and successfully retried.
- Fname transfer responses are first-party registry records with user/server signature fields. This analysis did not independently validate those signatures; ENS/Basename names were independently reverse/forward resolved onchain.
- **Lookalikes were excluded:** amirk, mahnaz and hellia resolve to different FIDs/addresses from amirk.eth, mahnaz.eth and hellia.eth. The same-name account alone is not evidence.

## Evidence

- [Analysis, exact joins and every account’s address set](analysis.json)
- [Farcaster client API reference](https://docs.farcaster.xyz/reference/farcaster/api) establishes the official hostname and pagination; the two live v2 profile/verification endpoints were directly observed public client responses, not represented as fully documented there. Saved source: source-client-api.json.
- [Fname registry documentation](https://docs.farcaster.xyz/reference/fname/api) and saved per-FID responses.
- [Protocol verification semantics](https://snapchain.farcaster.xyz/reference/httpapi/verification).
- [Basenames official deployment/source](https://github.com/base/basenames/blob/main/README.md); direct Base resolver reads at block 53007240 in basenames-all.json.

No votes, rankings, production records, account settings or messages were changed.
