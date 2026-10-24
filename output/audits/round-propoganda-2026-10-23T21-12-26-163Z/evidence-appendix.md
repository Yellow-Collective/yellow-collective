# Evidence appendix — final Propoganda audit

## Scope and sources

Round: e7c5cc86-dbc3-43fc-8ff1-795d4b997c33, slug propoganda. Production Railway project af512d4f-60b5-42a8-b7dc-bf337fa00c1d; environment production; service 9472c187-a023-46d2-b39e-4f42a88d3b51; host gondola.proxy.rlwy.net; database railway. Cutoff: 2026-10-23T21:12:26.163Z. Repeatable-read transaction asserted transaction_read_only=on and rolled back. The collector requires the round to be closed. TLS validates the existing service CA plus the exact public leaf certificate retrieved during the prior user-approved SSH setup; a mismatch fails closed. No credentials were written to artifacts.

Source revision: a4b697cbdf50d53f56bf3935431f754d2c83446d. Rules inspected in data/rounds.ts and utils/rounds/getRoundVotingPower.ts: positive getVotes at snapshot, base 50 + getVotes, 15 per entry, own-address rejection, approved/nondeleted targets. Stored round settings agree. Source parity with the deployed binary was not independently established. The winner finalizer orders total votes DESC then submission created_at DESC; all ten stored winners match that ranking.

Base 8453, NFT contract 0x220e41499cf4d93a3629a5509410cbf9e6e0b109. Voting snapshot block **52697526** (October 16, 20:59:59 UTC); final chain cutoff **53000299** (October 23, 21:12:25 UTC). Fresh genesis-to-cutoff scan: **54 contiguous ranges**, no failures/duplicates; **2,251 Transfer, 34 DelegateChanged, 3,385 DelegateVotesChanged** logs. Largest range 341 events, below 1,000. All 59 voter balances and delegate-aware voting power reconstructed from events match historical RPC reads. Snapshot supply: **973 minted IDs − 132 burned = 841 live NFTs**. No transfers after the snapshot were counted as new eligibility.

Explorer: official Etherscan MCP, explicit chainid 8453. Live target-chain transactions and receipts worked despite the bundled chain-list snapshot labeling Base as paid-plan-required. No credentials or paid plan were configured. We collected bounded earliest-first normal-transaction pages of 100 for selected wallets, plus two bounded recent submitter queries. Pages hitting 100 are **partial**; empty responses do not rule out internal/cross-chain activity. See explorer-analysis.json for every queried address/count/truncation. Six spanning native-transfer edges linking the seven late voters, five submitter/3ba native transactions, three NFT-source transactions, NFT 399 and one delegation transaction were independently corroborated against RPC (**16 successful matches**). Five older material receipts also matched; one overlaps, so **20 unique material receipt hashes** across these files.

No complete ETH/internal-transaction census, device/IP logs, cross-chain identity attribution or offchain payment review was performed. Same controller, paid sale, gift, shared expenses, friendship and household relationships remain competing explanations. Historical NFT/delegation relationships do not alone establish control. A single RPC aggregator supplied the full event scan; state reconciliation and selected primary-RPC/Etherscan receipts corroborate it but are not an independent census of every historical log.

## Wallet groups

### F01: NEW: seven connected late voters

**Beneficiary submitter(s):** [0xcb6e…7527](https://www.yellowcollective.art/profile/0xcb6eb98d0533dd42367cd064fc5b988814187527) · [BaseScan](https://basescan.org/address/0xcb6eb98d0533dd42367cd064fc5b988814187527); [0xa09a…258b](https://www.yellowcollective.art/profile/0xa09aa75da763d4aeb692672897c057786cdd258b) · [BaseScan](https://basescan.org/address/0xa09aa75da763d4aeb692672897c057786cdd258b); [0x7802…4a44](https://www.yellowcollective.art/profile/0x7802cc411bfe02655fadfa5b23f9db3382d84a44) · [BaseScan](https://basescan.org/address/0x7802cc411bfe02655fadfa5b23f9db3382d84a44); [0x1bae…4c33](https://www.yellowcollective.art/profile/0x1bae19af613bd5db94baf043d5817e16a53a4c33) · [BaseScan](https://basescan.org/address/0x1bae19af613bd5db94baf043d5817e16a53a4c33); [0x215d…03d7](https://www.yellowcollective.art/profile/0x215db99298af65306a4c60bd3b7612d5f60b03d7) · [BaseScan](https://basescan.org/address/0x215db99298af65306a4c60bd3b7612d5f60b03d7); [0x9ab5…06f6](https://www.yellowcollective.art/profile/0x9ab51fd89f163d07127df192b615356d53b406f6) · [BaseScan](https://basescan.org/address/0x9ab51fd89f163d07127df192b615356d53b406f6).

**Owner assessment:** UNKNOWN. Common operation or close coordination is plausible; no submitter ownership established.

**OBSERVED / INFERRED limits:** Seven first-time platform voters allocated 360 votes in 34m 1.440s on October 23, 19:50:44.033627–20:24:45.473238 UTC. Each gave Support Yellow Artists 15 votes (105 combined). They have 82 distinct non-self native transfers within the bounded explorer pages plus an NFT transfer (#399) between group members. A six-edge native-transfer spanning tree and #399 receipt were corroborated against RPC. Funding links began years before this round; this is not evidence that the wallets were freshly created for this vote. Alternate explanations include friends, household members or coordinated genuine supporters.

| Voting wallet | Votes in this review group | Entry breakdown |
|---|---:|---|
| [0xdc37…11f1](https://www.yellowcollective.art/profile/0xdc37e6f67bfb7361e25731fc477903e172d211f1) · [BaseScan](https://basescan.org/address/0xdc37e6f67bfb7361e25731fc477903e172d211f1) | 52 | Support Yellow Artists: 15; Yellow🟡 The Culture We Own: 15; FARCASTER EAT FIRST: 7; We can make it!: 15 |
| [0x0b81…19f7](https://www.yellowcollective.art/profile/0x0b81bffce9970aca9868120eee1bcc8de19119f7) · [BaseScan](https://basescan.org/address/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | 53 | Support Yellow Artists: 15; Perpetual Collective Machine - Loop Animation: 15; We can make it!: 10; Yellow🟡 The Culture We Own: 13 |
| [0xeb8a…2c00](https://www.yellowcollective.art/profile/0xeb8a03b68e4f5ee0f02ff612915bfafba4902c00) · [BaseScan](https://basescan.org/address/0xeb8a03b68e4f5ee0f02ff612915bfafba4902c00) | 51 | Yellow🟡 The Culture We Own: 15; We can make it!: 2; Free the DAO: 4; Support Yellow Artists: 15; Perpetual Collective Machine - Loop Animation: 15 |
| [0x0816…240c](https://www.yellowcollective.art/profile/0x08165c34b6689a7b35ec1a57d1265f83e758240c) · [BaseScan](https://basescan.org/address/0x08165c34b6689a7b35ec1a57d1265f83e758240c) | 51 | Support Yellow Artists: 15; 💛Paint the world Yellow💛: 15; We can make it!: 15; Yellow🟡 The Culture We Own: 6 |
| [0x0756…9740](https://www.yellowcollective.art/profile/0x07566caf069465977e9b0d3a96629c73a6c69740) · [BaseScan](https://basescan.org/address/0x07566caf069465977e9b0d3a96629c73a6c69740) | 51 | Yellow🟡 The Culture We Own: 15; Free the DAO: 15; Support Yellow Artists: 15; 💛Paint the world Yellow💛: 6 |
| [0xb15a…ef3d](https://www.yellowcollective.art/profile/0xb15acc09c28226c7b47918f14951a65a0671ef3d) · [BaseScan](https://basescan.org/address/0xb15acc09c28226c7b47918f14951a65a0671ef3d) | 51 | 💛Paint the world Yellow💛: 15; Perpetual Collective Machine - Loop Animation: 5; Support Yellow Artists: 15; Yellow🟡 The Culture We Own: 1; We can make it!: 15 |
| [0x3147…792b](https://www.yellowcollective.art/profile/0x31475a5652efbb267b3afdd9591ef05406db792b) · [BaseScan](https://basescan.org/address/0x31475a5652efbb267b3afdd9591ef05406db792b) | 51 | 💛Paint the world Yellow💛: 10; We can make it!: 15; Support Yellow Artists: 15; Yellow🟡 The Culture We Own: 1; Perpetual Collective Machine - Loop Animation: 10 |

### F02: NEW in this round: Paint transfer-linked pair

**Beneficiary submitter(s):** [0x9ab5…06f6](https://www.yellowcollective.art/profile/0x9ab51fd89f163d07127df192b615356d53b406f6) · [BaseScan](https://basescan.org/address/0x9ab51fd89f163d07127df192b615356d53b406f6).

**Owner assessment:** Submitter 9ab5 is the verified NFT source and the candidate associated owner for review; common control remains unproven.

**OBSERVED / INFERRED limits:** b897 and 79ed each allocated 15 to Paint the world Yellow. The beneficiary previously transferred NFT 870 to b897 on September 22 and NFT 860 to 79ed on September 24. Successful sender-initiated transferFrom transactions corroborated by Etherscan and RPC. Both wallets also voted for other submitters in this round. These were the transfer-linked addresses discussed in the earlier comic-strip audit, but that earlier suspicion is not used as proof of ownership here.

| Voting wallet | Votes in this review group | Entry breakdown |
|---|---:|---|
| [0xb897…6c6b](https://www.yellowcollective.art/profile/0xb89743f3b06d66ed5d7e3bbdf8312f6856de6c6b) · [BaseScan](https://basescan.org/address/0xb89743f3b06d66ed5d7e3bbdf8312f6856de6c6b) | 15 | 💛Paint the world Yellow💛: 15 |
| [0x79ed…af6e](https://www.yellowcollective.art/profile/0x79ed59c8c92ff3f3384c2c43e1088e6b56e8af6e) · [BaseScan](https://basescan.org/address/0x79ed59c8c92ff3f3384c2c43e1088e6b56e8af6e) | 15 | 💛Paint the world Yellow💛: 15 |

### F03: Expanded: Slop submitter-linked voters

**Beneficiary submitter(s):** [0x215d…03d7](https://www.yellowcollective.art/profile/0x215db99298af65306a4c60bd3b7612d5f60b03d7) · [BaseScan](https://basescan.org/address/0x215db99298af65306a4c60bd3b7612d5f60b03d7).

**Owner assessment:** Submitter 215d is the candidate associated owner for review; UNKNOWN beneficial ownership. Repeated native transfers strengthen the 3ba relationship, but gifts, repayments or shared expenses remain possible.

**OBSERVED / INFERRED limits:** 4e2a allocated 34 across Free the DAO (4), Make Art Great Again (15), TOO MUCH SLOP (15) and received NFT 318 from the submitter in August 2026. 3ba allocated 30 across the latter two entries, has three retained allocations over two rounds, all for this submitter, and received 0.001 ETH from the submitter in June 2024 before returning ETH on four observed occasions in August/September 2024. Those five native transactions were receipt-verified. Native funding is a verified relationship, not proof of control.

| Voting wallet | Votes in this review group | Entry breakdown |
|---|---:|---|
| [0x4e2a…aa25](https://www.yellowcollective.art/profile/0x4e2a3a65d0e2bcdb507a70fe2d3fc5dff464aa25) · [BaseScan](https://basescan.org/address/0x4e2a3a65d0e2bcdb507a70fe2d3fc5dff464aa25) | 34 | Free the DAO: 4; Make Art Great Again: 15; TOO MUCH SLOP: 15 |
| [0x3ba0…dded](https://www.yellowcollective.art/profile/0x3ba02da5b9fe77aed5592e934f7ec15381b3dded) · [BaseScan](https://basescan.org/address/0x3ba02da5b9fe77aed5592e934f7ec15381b3dded) | 30 | TOO MUCH SLOP: 15; Make Art Great Again: 15 |

### F04: Unchanged: four-wallet 120-vote cluster

**Beneficiary submitter(s):** [0x7802…4a44](https://www.yellowcollective.art/profile/0x7802cc411bfe02655fadfa5b23f9db3382d84a44) · [BaseScan](https://basescan.org/address/0x7802cc411bfe02655fadfa5b23f9db3382d84a44).

**Owner assessment:** UNKNOWN. No direct submitter-to-voter NFT or delegation relationship found in the complete configured-contract event history.

**OBSERVED / INFERRED limits:** Each wallet gave Museum and We can make it 15 each; 60 per entry, 120 combined. Ballots were cast within 115.266419 seconds on October 19 and remained unchanged. Three have historical links to the same external delegator at different times; they did not reuse a single NFT simultaneously for this round snapshot.

| Voting wallet | Votes in this review group | Entry breakdown |
|---|---:|---|
| [0xf7ae…14de](https://www.yellowcollective.art/profile/0xf7aef946d3f2e58a3685166ace1fc3db76d614de) · [BaseScan](https://basescan.org/address/0xf7aef946d3f2e58a3685166ace1fc3db76d614de) | 30 | The Museum Has No Front Desk: 15; We can make it!: 15 |
| [0x5171…b11f](https://www.yellowcollective.art/profile/0x517186eefab9d631e7ddbed521740e84afd9b11f) · [BaseScan](https://basescan.org/address/0x517186eefab9d631e7ddbed521740e84afd9b11f) | 30 | The Museum Has No Front Desk: 15; We can make it!: 15 |
| [0x5eaa…e46b](https://www.yellowcollective.art/profile/0x5eaa352f438023f956f8e6bd581f37a67971e46b) · [BaseScan](https://basescan.org/address/0x5eaa352f438023f956f8e6bd581f37a67971e46b) | 30 | The Museum Has No Front Desk: 15; We can make it!: 15 |
| [0xe348…0a6d](https://www.yellowcollective.art/profile/0xe348b541dd51c5e7b32557f055f7205e6d8c0a6d) · [BaseScan](https://basescan.org/address/0xe348b541dd51c5e7b32557f055f7205e6d8c0a6d) | 30 | The Museum Has No Front Desk: 15; We can make it!: 15 |

### F05: Unchanged: Draw-only voters

**Beneficiary submitter(s):** [0x15c6…3e7b](https://www.yellowcollective.art/profile/0x15c6a4bf9023ad20c51cbea9992a5bccf83f3e7b) · [BaseScan](https://basescan.org/address/0x15c6a4bf9023ad20c51cbea9992a5bccf83f3e7b).

**Owner assessment:** UNKNOWN. Voting-pattern lead only; no direct NFT/delegation relationship to the submitter.

**OBSERVED / INFERRED limits:** Three wallets each placed one retained platform allocation, 15 for Draw or Die. They held NFTs long before this round. No new evidence establishing submitter control was found.

| Voting wallet | Votes in this review group | Entry breakdown |
|---|---:|---|
| [0x5d69…6134](https://www.yellowcollective.art/profile/0x5d69c42a3a481d0ccfd88cfa8a2a08e2bf456134) · [BaseScan](https://basescan.org/address/0x5d69c42a3a481d0ccfd88cfa8a2a08e2bf456134) | 15 | Draw or Die! 🫀 by msmeghna: 15 |
| [0x8f3a…9e3c](https://www.yellowcollective.art/profile/0x8f3a83a3356d2666d89d027544bbaffa12139e3c) · [BaseScan](https://basescan.org/address/0x8f3a83a3356d2666d89d027544bbaffa12139e3c) | 15 | Draw or Die! 🫀 by msmeghna: 15 |
| [0x282d…8dc0](https://www.yellowcollective.art/profile/0x282d656a9d95c64522f6bc1a42ee759de81e8dc0) · [BaseScan](https://basescan.org/address/0x282d656a9d95c64522f6bc1a42ee759de81e8dc0) | 15 | Draw or Die! 🫀 by msmeghna: 15 |

## Material transactions

- [transaction](https://basescan.org/tx/0xc70cd3e77c40778a8074ceb72a383b299c2e56ace3e4ed466626b1a021f0e534) — 0x215d…03d7 → 0x3ba0…dded; 0x38d7ea4c68000 wei (hex); block 16242976; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0xe2096093e68062622f13338b3732051692a009e401ed9df5f5124396040167fa) — 0x3ba0…dded → 0x215d…03d7; 0x27ca57357c000 wei (hex); block 19007794; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0x89b48fae521ea20339d6a377530c7e75e53950c94bba7ca125d4962f28842696) — 0x3ba0…dded → 0x215d…03d7; 0x9536c708910000 wei (hex); block 19140012; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0xef5137df58afacd3058485103603c66b98872ca5351685d55e6e17adc444e8cb) — 0x3ba0…dded → 0x215d…03d7; 0x38d7ea4c68000 wei (hex); block 19140245; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0x0eb6770a5ca3387c12bd48ab1f0e2554134ac05d032db5d43d832e1e801238db) — 0x3ba0…dded → 0x215d…03d7; 0x8bd5b6225c000 wei (hex); block 19694659; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0x2ed0964808b7e39ec53ea078ddd8822a1c32c6cc5ac452ec6b0ad2af55b6f67c) — 0xdc37…11f1 → 0x0756…9740; 0x4d4e9ace50000 wei (hex); block 18607449; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0x3333e9f748667fb160e5dcfba28f4dbbb5dbf1ffbd0f64188042d88434c17385) — 0xeb8a…2c00 → 0x0756…9740; 0x21e5b371165f3 wei (hex); block 19108169; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0xe24ce17973939f516fcd3c31e1527f12ea743bcb85d47ad305bfc55de7e6588f) — 0x0b81…19f7 → 0x0756…9740; 0x43b93a3e681a8 wei (hex); block 19108247; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0x8c8720e25b82f183112a59c0cda33fec649a9245a71d4cf73972fdac8995c871) — 0x0756…9740 → 0x0816…240c; 0x38d7ea4c68000 wei (hex); block 30644333; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0x0e36e55cc99af3518f54cd2a1449e66a23b165de01109c9871e6bca04a35eaaf) — 0xdc37…11f1 → 0x3147…792b; 0x110d9316ec000 wei (hex); block 18204429; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0x7f1b34e1965aec281b891e6a92d6ec37b566f960602e0aeee469db8bd349cac4) — 0x0b81…19f7 → 0xb15a…ef3d; 0x3328b944c4000 wei (hex); block 24735120; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0x302072f37a511d291ec55a62c0c0144c64eee30a170e5f52ba4150dc70c1f6bd) — 0x215d…03d7 → 0x220e…b109; 0x0 wei (hex); block 49716374; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0xbb6e12f73cc88206bb3d1a1595ee26e80df0eb3efe6da35bebb6057cf2838027) — 0x9ab5…06f6 → 0x220e…b109; 0x0 wei (hex); block 51637032; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0xe8d03281c3f5c5cff59d7870d941dbe43c3a0b6756653e25bfe09ca05906a817) — 0x9ab5…06f6 → 0x220e…b109; 0x0 wei (hex); block 51736346; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0x0371d680ae85842fdf84c4a4c41882a77b925d48806344cb079484b9ff5cd383) — 0xdc37…11f1 → 0x0000…1a72; 0x0 wei (hex); block 24528406; successful receipt, explorer/RPC fields matched.
- [transaction](https://basescan.org/tx/0x6a7267c9e0e0ab30fafc8c671c66522e9e39cdadba69aaf51b7e3f3d7ed94f76) — 0xedc1…e7e1 → 0x220e…b109; 0x0 wei (hex); block 45264169; successful receipt, explorer/RPC fields matched.

## Additional leads and exclusions

- [0xae47…5fed](https://www.yellowcollective.art/profile/0xae4705dc0816ee6d8a13f1c72780ec5021915fed) · [BaseScan](https://basescan.org/address/0xae4705dc0816ee6d8a13f1c72780ec5021915fed) sent 45 votes to the Slop submitter's three entries; this remains a pattern-only lead, separately from the linked 64.
- [0xedc1…e7e1](https://www.yellowcollective.art/profile/0xedc1a397589a0236c4810883b7d559288a5fe7e1) · [BaseScan](https://basescan.org/address/0xedc1a397589a0236c4810883b7d559288a5fe7e1) historically delegated to submitter 215d and allocated 5 to Make Art Great Again this round. At this snapshot it self-delegated and had 7 voting power; its old delegation is not counted as extra current eligibility. This weaker, old association remains separate from the 64.
- [0x9ffa…f28b](https://www.yellowcollective.art/profile/0x9ffaab6c24d4fb58d61b26b08c8795e9e323f28b) · [BaseScan](https://basescan.org/address/0x9ffaab6c24d4fb58d61b26b08c8795e9e323f28b) sent 15 to Support Yellow Artists and 15 elsewhere. Its earlier concentration over four rounds is unchanged; no submitter-control attribution is established.
- The prior Candleman-associated wallets cba18/3b6a voted in this round but allocated zero to that same submitter's current Perpetual entry. Historical suspicion was not used as an automatic flag.
- NFT/ETH distributions from common infrastructure and ordinary auction settlement are not treated as proof of common ownership. One deleted submission has zero ballots; all 308 allocations target the 22 active approved entries.

## Stored final winners

| Position | Entry | Votes |
|---:|---|---:|
| 1 | Support Yellow Artists | 318 |
| 2 | Perpetual Collective Machine - Loop Animation | 300 |
| 3 | 💛Paint the world Yellow💛 | 296 |
| 4 | Draw or Die! 🫀 by msmeghna | 276 |
| 5 | TOO MUCH SLOP | 247 |
| 6 | We can make it! | 245 |
| 7 | Yellow🟡 The Culture We Own | 182 |
| 8 | YELLOW IS EVERYWHERE | 167 |
| 9 | The Museum Has No Front Desk | 161 |
| 10 | Keep the yellow spirit! | 115 |

## Reproduction and files

Run from repository root:

`railway run --project af512d4f-60b5-42a8-b7dc-bf337fa00c1d --environment production --service 9472c187-a023-46d2-b39e-4f42a88d3b51 --no-local -- node output/audits/propoganda-final-tooling-20261023/collect-final.cjs --round propoganda`

Each database collection creates a new cutoff folder. Chain/analysis scripts under output/audits/propoganda-final-tooling-20261023 currently point at this exact audit folder; select the new folder before a new collection. Preserve the pinned certificates' provenance and fail on changes. No app/API GET endpoints were called.

- database-snapshot.json / database-manifest.json: raw rows and read-only metadata.
- wallet-patterns.json / analysis.json / findings.json: cross-round comparisons and exact review allocations.
- rpc-log-ranges.json / rpc-events.json / historical-state.json: raw event coverage and point-in-time state.
- etherscan-txs-*.json / explorer-analysis.json: bounded public explorer history, retrieval timestamps and truncation.
- extra-explorer-evidence.json / extra-rpc-corroboration.json / material-receipts.json: material verification.
- audit-validation.json / final-review.json: exclusions, balances, power, budgets, close-time checks and winner reconciliation.
- rankings-scenarios.json: separate hypothetical removals. Groups overlap (105 is a subset of 360); do not sum them or combine scenarios without de-duplicating ballot IDs.

The initial October 20 audit at ../round-propoganda-2026-10-20T13-33-16-160Z is preserved. This rerun wrote only new output/audits artifacts, used existing provider configuration and read relevant memory. Source notes, .obsidian, imported notes, plugin configuration, automation state and memory were not changed.
