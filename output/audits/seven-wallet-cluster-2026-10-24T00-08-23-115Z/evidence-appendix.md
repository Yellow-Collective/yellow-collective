# Evidence appendix — seven-wallet cluster

## 1. Scope

- Round: propoganda, ID e7c5cc86-dbc3-43fc-8ff1-795d4b997c33.
- Final production snapshot: 2026-10-23T21:12:26.163Z; voting ended 2026-10-23T21:00:00+00:00.
- Source audit: C:\Users\Deej\Documents\GitHub\yellowcollective\output\audits\round-propoganda-2026-10-23T21-12-26-163Z.
- Base chain ID **8453**; Collective Nouns **0x220e41499cf4d93a3629a5509410cbf9e6e0b109**.
- Voting snapshot block **52,697,526**; cutoff block **53,000,299**.
- This follow-up reused the final production export and did not reopen production. Original database identity/read-only assertion is saved in its metadata.
- Original NFT scan: blocks 0–53,000,299, 54 contiguous ranges, 2,251 transfers and 34 DelegateChanged events, with no reported gaps/failed ranges/duplicates.
- New explorer evidence: official Etherscan MCP with explicit chain 8453; two targeted bridge-origin deposits/transactions on Ethereum chain 1. Responses and pagination are saved alongside this file.

## 2. Address directory

| ID | Full address / BaseScan | Yellow profile | Role |
|---|---|---|---|
| A | [0xdc37e6f67bfb7361e25731fc477903e172d211f1](https://basescan.org/address/0xdc37e6f67bfb7361e25731fc477903e172d211f1) | [Profile](https://www.yellowcollective.art/profile/0xdc37e6f67bfb7361e25731fc477903e172d211f1) | Member of seven; owner unknown |
| B | [0x0b81bffce9970aca9868120eee1bcc8de19119f7](https://basescan.org/address/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | [Profile](https://www.yellowcollective.art/profile/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | Member of seven; owner unknown |
| C | [0xeb8a03b68e4f5ee0f02ff612915bfafba4902c00](https://basescan.org/address/0xeb8a03b68e4f5ee0f02ff612915bfafba4902c00) | [Profile](https://www.yellowcollective.art/profile/0xeb8a03b68e4f5ee0f02ff612915bfafba4902c00) | Member of seven; owner unknown |
| D | [0x08165c34b6689a7b35ec1a57d1265f83e758240c](https://basescan.org/address/0x08165c34b6689a7b35ec1a57d1265f83e758240c) | [Profile](https://www.yellowcollective.art/profile/0x08165c34b6689a7b35ec1a57d1265f83e758240c) | Member of seven; owner unknown |
| E | [0x07566caf069465977e9b0d3a96629c73a6c69740](https://basescan.org/address/0x07566caf069465977e9b0d3a96629c73a6c69740) | [Profile](https://www.yellowcollective.art/profile/0x07566caf069465977e9b0d3a96629c73a6c69740) | Member of seven; owner unknown |
| F | [0xb15acc09c28226c7b47918f14951a65a0671ef3d](https://basescan.org/address/0xb15acc09c28226c7b47918f14951a65a0671ef3d) | [Profile](https://www.yellowcollective.art/profile/0xb15acc09c28226c7b47918f14951a65a0671ef3d) | Member of seven; owner unknown |
| G | [0x31475a5652efbb267b3afdd9591ef05406db792b](https://basescan.org/address/0x31475a5652efbb267b3afdd9591ef05406db792b) | [Profile](https://www.yellowcollective.art/profile/0x31475a5652efbb267b3afdd9591ef05406db792b) | Member of seven; owner unknown |
| H | [0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d](https://basescan.org/address/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | [Profile](https://www.yellowcollective.art/profile/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | NFT supplier, outside seven; owner unknown |
| I | [0xcd295a33541d5aeb259c05ad51ef12b5e7fa30c1](https://basescan.org/address/0xcd295a33541d5aeb259c05ad51ef12b5e7fa30c1) | [Profile](https://www.yellowcollective.art/profile/0xcd295a33541d5aeb259c05ad51ef12b5e7fa30c1) | Funding intermediary, outside seven; owner unknown |

None of the seven had an identifying profile row in the saved production export. An absent profile is not evidence of concealment. H/I are additional counterparties, excluded from the seven-wallet vote totals.

## 3. NFT acquisitions

Received date is actual wallet delivery. Auction price comes from AuctionSettled and is matched to the final AuctionBid, its sender and native value. Bid date can precede delivery; settlement caller is not necessarily the buyer.

| NFT | Recipient | Received UTC | Acquisition / ETH | Evidence |
|---|---|---|---|---|
| #292 | B | 2024-08-30 16:46:05 UTC | Auction **0.0377 ETH**; winning bid 2024-08-29 20:27:35 UTC | [receipt](https://basescan.org/tx/0x32c2c2b672347e7f1c7af830f6070ccea8eced170a7190db272bd1faf4872ec0) / [bid](https://basescan.org/tx/0xba18e9e426234e80b2dfcf7de56505db08e4388669b92f95c498e27b58ea766a) |
| #308 | A | 2024-09-13 18:22:27 UTC | Auction **0.0242 ETH**; winning bid 2024-09-13 18:16:53 UTC | [receipt](https://basescan.org/tx/0x8a87e19e7d15e0ba6294ea12418da1b42ffcd85b7ff8b6e9bc1c28bd32dec547) / [bid](https://basescan.org/tx/0x2970af1d7a5c29cde4c09186db1bacc70a1399776e325ae6e25770c097a49e25) |
| #309 | B | 2024-09-14 18:23:19 UTC | Auction **0.02662 ETH**; winning bid 2024-09-14 18:16:15 UTC | [receipt](https://basescan.org/tx/0xa9364756336c85e79f39374659bb95d275e0d4f314b28e3528750b1f10502a29) / [bid](https://basescan.org/tx/0x81e473eea2bd6f986a31f904bb98d344f33e237e20ca86db2e9e264a50e9d672) |
| #312 | H | 2024-09-15 18:31:25 UTC | Auction **0.033 ETH**; winning bid 2024-09-14 20:36:55 UTC | [receipt](https://basescan.org/tx/0x55de008884b8e751d7debbcc60934a34cec130e9508ea9484cfe9df5ba26fd07) / [bid](https://basescan.org/tx/0xa62feed1ad6927925880cb8588879a4546f29f663404e6bc41098d33e3e2822a) |
| #312 | C | 2024-09-15 19:53:59 UTC | Transfer from H; terms discussed below | [receipt](https://basescan.org/tx/0x814b71fb073a8e1839cf13d5d4e43b2928182eb78454c8d9f0c89d45d27a0d1d) |
| #313 | H | 2024-09-16 18:34:35 UTC | Auction **0.022 ETH**; winning bid 2024-09-16 18:28:13 UTC | [receipt](https://basescan.org/tx/0x3411f123be75b4bedd9fee925b523ede62a670d13b09441b12bd0bf7c2099e0b) / [bid](https://basescan.org/tx/0xcfb139cf7d90869601b543d0ed91250c2ddaf62d5c12b695d059fbd10535a7a6) |
| #328 | A | 2024-09-29 20:52:01 UTC | Auction **0.0363 ETH**; winning bid 2024-09-29 20:46:21 UTC | [receipt](https://basescan.org/tx/0x9a78f3079896c6b0ec7d1cdb508fd8074b4878df553976caa5e7304517c9c127) / [bid](https://basescan.org/tx/0x5aeea03745c03a334cff0c533f8a0006d38c51437724b084611caea81bdc0f32) |
| #399 | A | 2024-11-26 05:33:25 UTC | Auction **0.01 ETH**; winning bid 2024-11-25 05:46:07 UTC | [receipt](https://basescan.org/tx/0x83c64db334d0ae9e2e402d2e9cdb9954497292fcbbb13d91a5ddb2744b3a83a4) / [bid](https://basescan.org/tx/0x99542340c78e95333bf4c68485e90167e331338c1524773bfa520e494f750e42) |
| #403 | D | 2024-11-28 05:39:25 UTC | Auction **0.0121 ETH**; winning bid 2024-11-28 05:32:41 UTC | [receipt](https://basescan.org/tx/0xb3964508e01e6d6a0087e3ac2dccdc4d7f3cc4a37ca1f3b4e6b3d8f136373897) / [bid](https://basescan.org/tx/0xa3a5ccea523e8c515151af59bd6998cb3accdd6efb2320e9af3502995d5a7ca2) |
| #407 | G | 2024-12-02 06:22:15 UTC | Auction **0.01618 ETH**; winning bid 2024-12-02 06:15:11 UTC | [receipt](https://basescan.org/tx/0x5278e70256cfd70607e436b1415d1a4912078f9c273c3b47aeef27583f9f5ef7) / [bid](https://basescan.org/tx/0x872e2a277a9c6134049b2036c21e8b582fe2334afede712b150da4389f33b612) |
| #399 | E | 2025-01-02 19:29:19 UTC | Transfer from A; terms discussed below | [receipt](https://basescan.org/tx/0x0371d680ae85842fdf84c4a4c41882a77b925d48806344cb079484b9ff5cd383) |
| #313 | F | 2025-01-27 12:03:43 UTC | Transfer from H; terms discussed below | [receipt](https://basescan.org/tx/0x9608e431d7d98bf96acf5aaa7f1ef2f39997b0ff75d35241a545cb6ed3241ff1) |
| #549 | B | 2025-03-27 10:02:25 UTC | Auction **0.00517 ETH**; winning bid 2025-03-27 09:53:29 UTC | [receipt](https://basescan.org/tx/0x7787a700f426bac059c9b8b0b0b942deff658c12ec36add762b8fd0e785659a8) / [bid](https://basescan.org/tx/0xac889bc8460a780d3a176eccfc4ef143785782924657499f308aded858a9e809) |

### NFT 312: likely purchase or reimbursement

1. H won #312 for **0.033 ETH**, receiving it at **2024-09-15 18:31:25 UTC**.
2. C sent H **0.033 ETH** at **19:09:41 UTC**: [payment](https://basescan.org/tx/0x990cc7082a705330b2823b40b0b2c031131a7afb2a2c341d63b6832e94761e68).
3. H sent #312 to C at **19:53:59 UTC**: [delivery](https://basescan.org/tx/0x814b71fb073a8e1839cf13d5d4e43b2928182eb78454c8d9f0c89d45d27a0d1d).
**INFERRED:** matching price and payment **44m18s before delivery** are consistent with an at-cost purchase/reimbursement. It was not an atomic marketplace sale. C had also placed an earlier 0.01 ETH bid in this auction. These observations do not establish common control.

### NFT 399: A to E

A won #399 for 0.01 ETH in November 2024 and sent it to E on 2025-01-02. Transfer transaction value was zero; receipt has NFT/voting-power logs and no ERC-20 payment event; explorer internal history reports no native payment in that transaction. No A/E native ETH movement appeared within three days before or after delivery in the collected histories. **UNKNOWN:** gift, custody, reallocation, separate sale or other arrangement. It is not a proven free gift.

### NFT 313: H to F

H won #313 for 0.022 ETH in September 2024 and sent it to F on 2025-01-27. No successful positive native ETH transfer between H/F was found in the collected histories. Transfer transaction value was zero, with no reported internal ETH payment or ERC-20 payment log. **UNKNOWN:** terms, separate-token/offchain payment or control relationship.

## 4. Direct native ETH connections

Successful positive native ETH movements only; no self-calls. Normal transactions deduplicated by hash; internal traces by hash/trace/from/to/value. Amounts sum both directions and represent gross movement, not unique capital or net funding.

| Pair | Direct transactions | Internal traces | Gross ETH | First → last observed date UTC | Example |
|---|---:|---:|---:|---|---|
| B ↔ A | 79 | 0 | 1.763101 | 2024-04-20 → 2026-04-14 | [example](https://basescan.org/tx/0xb253a2407b087b5867f1bcc4e444753ed3b61b720833f160a232078e924c5dff) |
| D ↔ A | 22 | 0 | 0.079818 | 2024-07-25 → 2025-08-07 | [example](https://basescan.org/tx/0xdf6d77fad2f3695d617bb0298e88375ca714a9bc8e8141bea2a9aaf2c2c2af65) |
| G ↔ A | 21 | 0 | 0.090899 | 2024-08-09 → 2025-09-28 | [example](https://basescan.org/tx/0x0e36e55cc99af3518f54cd2a1449e66a23b165de01109c9871e6bca04a35eaaf) |
| A ↔ C | 21 | 0 | 0.255294 | 2024-05-07 → 2025-07-12 | [example](https://basescan.org/tx/0xe2e909a124c726c859b85b2a3136c8b82e481ef614502507d8e3119c647f030b) |
| B ↔ G | 11 | 0 | 0.019666 | 2024-12-01 → 2026-04-14 | [example](https://basescan.org/tx/0xaa1b7a76c588bc2a4bff360600d0e28c5719f86830eacc1d4fe6ce38db7f799b) |
| B ↔ C | 10 | 0 | 0.010792 | 2024-05-07 → 2026-04-14 | [example](https://basescan.org/tx/0xa4400c79d8a0aca6aa2b1602991dc476acf6fb6ddf31ed96ef55c8d8c95061bd) |
| E ↔ A | 9 | 0 | 0.36726 | 2024-08-18 → 2025-05-18 | [example](https://basescan.org/tx/0x2ed0964808b7e39ec53ea078ddd8822a1c32c6cc5ac452ec6b0ad2af55b6f67c) |
| D ↔ B | 7 | 0 | 0.013338 | 2024-06-17 → 2025-02-11 | [example](https://basescan.org/tx/0x271f7d61903c6eaa53f4b09137e51a5f5c5e05af74223afbc07e4cf5d720e765) |
| E ↔ B | 6 | 1 | 0.168581 | 2024-08-30 → 2026-09-14 | [example](https://basescan.org/tx/0xe24ce17973939f516fcd3c31e1527f12ea743bcb85d47ad305bfc55de7e6588f) |
| B ↔ F | 4 | 0 | 0.0166 | 2025-01-07 → 2025-06-02 | [example](https://basescan.org/tx/0x7f1b34e1965aec281b891e6a92d6ec37b566f960602e0aeee469db8bd349cac4) |
| E ↔ C | 1 | 0 | 0.000596 | 2024-08-30 → 2024-08-30 | [example](https://basescan.org/tx/0x3333e9f748667fb160e5dcfba28f4dbbb5dbf1ffbd0f64188042d88434c17385) |
| E ↔ D | 1 | 0 | 0.001 | 2025-05-24 → 2025-05-24 | [example](https://basescan.org/tx/0x8c8720e25b82f183112a59c0cda33fec649a9245a71d4cf73972fdac8995c871) |
| D ↔ C | 1 | 0 | 0.0012 | 2025-05-24 → 2025-05-24 | [example](https://basescan.org/tx/0xfb04983239d74f02a5767210fbdd1ebb85e07387b1f4999417b7d8a37e9b1e99) |
| F ↔ A | 1 | 0 | 0.0065 | 2025-04-09 → 2025-04-09 | [example](https://basescan.org/tx/0xd70e7585b9478e74f1380ed216c530db0a4e8ef32ac1616c590bd2d084e509ff) |

**Total: 194 direct transactions, 1 internal trace, 14 address pairs.** Exact amounts and hashes are in native-transfer-ledger.csv/connections.json.

## 5. First observed Base funding

Earliest observed successful positive native ETH inflow is not proof of wallet creation or complete multichain funding.

| ID | First observed inflow UTC | Source | ETH | Evidence |
|---|---|---|---:|---|
| A | 2024-04-15 05:03:41 UTC | Across bridge; own Ethereum address | 0.028739223855115669 | [transaction](https://basescan.org/tx/0x04a361d8584eaa14675222930bd454c67594d73abc412f21dc228d49817fde43) |
| B | 2024-04-10 04:11:27 UTC | Across bridge; own Ethereum address | 0.029727703996707572 | [transaction](https://basescan.org/tx/0x02f88cf7da4f8bc41728895fabe439d3f7f5992c422a5d791ce9c4b1b05f6e6d) |
| C | 2024-05-07 07:56:13 UTC | B sent 0.002 ETH | 0.002 | [transaction](https://basescan.org/tx/0xa4400c79d8a0aca6aa2b1602991dc476acf6fb6ddf31ed96ef55c8d8c95061bd) |
| D | 2024-06-17 14:50:17 UTC | B sent 0.000185 ETH | 0.000185 | [transaction](https://basescan.org/tx/0x271f7d61903c6eaa53f4b09137e51a5f5c5e05af74223afbc07e4cf5d720e765) |
| E | 2024-08-18 18:04:05 UTC | A sent 0.00136 ETH | 0.00136 | [transaction](https://basescan.org/tx/0x2ed0964808b7e39ec53ea078ddd8822a1c32c6cc5ac452ec6b0ad2af55b6f67c) |
| F | 2025-01-07 13:05:03 UTC | I sent 0.0015 ETH; I funded by A/B | 0.0015 | [transaction](https://basescan.org/tx/0xfa27e2161233102c0c4badd7be04a54e014b0fdd3a1b931424772b4ccd142a13) |
| G | 2024-08-09 10:10:05 UTC | A sent 0.0003 ETH | 0.0003 | [transaction](https://basescan.org/tx/0x0e36e55cc99af3518f54cd2a1449e66a23b165de01109c9871e6bca04a35eaaf) |

## 6. Multistep connections

### B → I → F; A → I → F

- B sent I **1 ETH + 3 ETH** on **2024-09-03**: [1 ETH](https://basescan.org/tx/0x4104020462a5390a6221fd53e5ede6f5dee61a3e5c536f5fde81e0a394ede155) / [3 ETH](https://basescan.org/tx/0xd18024f7c692bbda82cc8ce89ac5d5bedb777281f456d994f30808aa4edd3ebc). B later sent 0.04 ETH on 2025-01-02.
- A sent I **0.553 ETH** on **2024-12-19**: [transaction](https://basescan.org/tx/0xde0dc3bc17ed9046a9d622cbb5b4a6c0ca44585a211a66d26dae912034253692); another 0.05 ETH on 2025-01-02.
- I sent F **0.0015 ETH** on **2025-01-07**, its first observed funding: [transaction](https://basescan.org/tx/0xfa27e2161233102c0c4badd7be04a54e014b0fdd3a1b931424772b4ccd142a13).
These are time-ordered two-step associations. They do not prove which specific funds were used or who controls I/F. I’s reported history reached final short pages: **20 normal transactions, zero internal transactions**. I also later moved ETH with A/E.

### B → H → C/F; A ↔ B → H → F

- B sent H ETH five times in May–August 2024; H sent B ETH once. A/H have four direct ETH transactions and G/H have three.
- Example B → H, **0.00114 ETH, 2024-05-07**: [transaction](https://basescan.org/tx/0x047765cfa022d3652631c6c7b9c17c95b8692b23635021887230befded302a9f). H later purchased #312/#313 and sent them to C/F.
- B → H → F combines a funding relationship with a later NFT transfer. A ↔ B → H → F is a three-step association. Neither proves that B’s ETH bought #313 or that one person owns the path.
- H also received NFTs 302, 324, 329, 424 and 544 from auction; its other NFT dealings do not create a direct link to the first-place submitter in the full ledger.

## 7. Ballots and control inference

| ID | Ballot time UTC, 2026-10-23 | Total votes | Support Yellow Artists | NFTs / getVotes at snapshot | Prior recorded voting rounds |
|---|---|---:|---:|---:|---:|
| A | 19:50:44 | 52 | 15 | 2 / 2 | 0 |
| B | 19:53:42 | 53 | 15 | 3 / 3 | 0 |
| C | 19:55:20 | 51 | 15 | 1 / 1 | 0 |
| D | 20:16:42 | 51 | 15 | 1 / 1 | 0 |
| E | 20:19:40 | 51 | 15 | 1 / 1 | 0 |
| F | 20:22:51 | 51 | 15 | 1 / 1 | 0 |
| G | 20:24:45 | 51 | 15 | 1 / 1 | 0 |

The seven cast **31 allocations / 360 votes**. Entry totals: Support Yellow Artists 105; We can make it! 72; Yellow The Culture We Own 66; Paint the world Yellow 46; Perpetual Collective Machine 45; Free the DAO 19; Farcaster Eat First 7. Their first/last ballot times are 34m1.44s apart. None of the seven is a submission’s submitting address in this round.

Voting rule: 50 base votes plus snapshot voting power, yielding budgets 52, 53 and five × 51; 15-per-entry cap. All seven used their full budgets. All nine NFTs held at the snapshot were already in their wallets by March 2025. No explicit DelegateChanged event involved any of the seven, H, I or the first-place submitter in the full contract scan; seven snapshot delegates are themselves.

**OBSERVED, high confidence:** repeated financial relationships, verified NFT movements, concentrated ballot timing and shared support.

**INFERRED, moderate confidence:** coordination or some shared control is plausible. A/B are central financial addresses. Friends, family, trading partners or a community voting together are alternatives. Shared auction participation does not establish ownership.

**UNKNOWN:** human owners; any submitter’s control; intent; whether a common-control voting rule was violated. No “likely owner” is assigned from vote preference alone.

## 8. Connection to first place

Support Yellow Artists finished first in the saved snapshot with **318 votes**; submitter **0xcb6eb98d0533dd42367cd064fc5b988814187527**. The seven supplied 105, about 33.0%. Vote support is not ownership evidence.

No direct successful native ETH link to the submitter was found in the collected histories. The submitter’s own normal and internal histories both reached a short last page. No direct Collective Nouns transfer/delegation link exists in the full contract ledger.

The two-step native joins found A/B/C/G and the submitter sharing [0xa5f5…9934](https://basescan.org/address/0xa5f565650890fba1824ee0f21ebbbf660a179934), verified as **RelayReceiver** on Base. H also shares this service. It is excluded from ownership inference.

An undirected graph combining saved ETH edges, expanded I history and all 2,251 NFT transfers was searched up to **four edges** from each of the seven to the submitter. Exclusions: mint/burn, Collective Nouns auction, DAO source of token 780, RelayReceiver, Across SpokePool. **No path remained in this bounded graph.** This does not cover every intermediary, token or chain.

### Rejected apparent common Ethereum funder

Base FilledV3Relay events show the same Ethereum depositor **0xe397c4883ec89ed4fc9d258f00c689708b2799c9** for A/B. Verified Ethereum source identifies it as **LI.FI AcrossFacetPacked**, a service contract. Matching origin deposit IDs/destination/recipient to the original transactions shows:

- **A**: Ethereum sender **0xdc37e6f67bfb7361e25731fc477903e172d211f1** → bridge contracts → same address on Base. [Ethereum origin](https://etherscan.io/tx/0xe073647c094e855286fcb8d146b48ab136b0dc3f3bc757dc525246664d898585) / [Base fill](https://basescan.org/tx/0x04a361d8584eaa14675222930bd454c67594d73abc412f21dc228d49817fde43). Deposit ID 1248402.
- **B**: Ethereum sender **0x0b81bffce9970aca9868120eee1bcc8de19119f7** → bridge contracts → same address on Base. [Ethereum origin](https://etherscan.io/tx/0xd759e8c376565fe16d739dc843d0ecf8fb5ee7ef8af31c97431d143ef3967a8a) / [Base fill](https://basescan.org/tx/0x02f88cf7da4f8bc41728895fabe439d3f7f5992c422a5d791ce9c4b1b05f6e6d). Deposit ID 1236037.

Thus each hub bridged from its own same-address Ethereum account. A common human-controlled origin was not established. Base relayers are service actors, not the owners of these wallets.

## 9. Coverage and limitations

| Address | Normal rows | Normal pagination | Internal rows | Internal pagination |
|---|---:|---|---:|---|
| A | 1388 | short final page | 4000 | **capped at four pages** |
| B | 2136 | short final page | 4000 | **capped at four pages** |
| C | 218 | short final page | 4000 | **capped at four pages** |
| D | 389 | short final page | 520 | short final page |
| E | 101 | short final page | 536 | short final page |
| F | 20 | short final page | 2 | short final page |
| G | 388 | short final page | 2039 | short final page |
| H | 2790 | short final page | 4000 | **capped at four pages** |
| First-place submitter | 3963 | short final page | 1165 | short final page |

- Account queries: genesis through Base 53,000,299, ascending, 1,000/page. Short pages establish provider-reported completion, not independent indexer completeness.
- A/B/C/H internal traces stop at 4,000 ascending records each; later internal activity may be missing. D/E/F/G/I/submitter reached short pages.
- No comprehensive ERC-20, unrelated NFT, global intermediary or crosschain identity crawl was performed. NFT payment absence in one transaction does not exclude separate arrangements.
- Initial RPC AuctionBid query returned no matching bids; it was not treated as evidence of absence. Official explorer ranges returned matching events. Ten auction ranges each returned fewer than 1,000 logs.
- Event signatures and actual historical data match the explorer implementation ABI. Historical implementation continuity is not assumed.
- Each NFT receipt, winner, amount, final bid sender/value, timestamp and first-funding origin was checked. Prior independent Base RPC ledger/state artifacts corroborate NFT ownership and snapshot power.
- Graph paths express association; they do not establish intent, identity, common control or provenance of individual units of ETH.

Address joins use exact case-normalized full addresses. Similar-looking prefix/suffix dust-transfer addresses are not merged with H, A or other subjects.

## 10. Artifacts and reproduction

- report.md: concise findings; report-data.json: structured conclusions/coverage.
- nft-acquisitions.json / nft-timeline.csv: full auction and transfer evidence.
- connections.json / native-transfer-ledger.csv: pair analysis and exact ETH movements, seven plus H/I.
- wallet-votes.csv: all 31 allocations, with IDs.
- verification.json: derivation checks; evidence-manifest.json: file SHA-256 hashes.
- Original explorer JSON responses and source/ABIs are saved beside the report.
- Rebuild from saved evidence by running analyze-connections.cjs, collect-nft-acquisitions.cjs, then build-report.cjs in this folder with Node from the repository.

No application source, votes, winners, accounts, production data, automation state, Obsidian files, plugin configuration or memory changed. Memory was read only for historical audit procedure; report counts use the final saved snapshot and chain evidence.
