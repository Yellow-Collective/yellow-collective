# Evidence appendix — ownership and patterns

## Snapshot and method

- Round: propoganda; ID e7c5cc86-dbc3-43fc-8ff1-795d4b997c33. Final DB snapshot reused; no new production query or mutation.
- Base mainnet 8453, cutoff block 53000299; historical eligibility block 52697526. Collective Nouns contract 0x220e41499cf4d93a3629a5509410cbf9e6e0b109.
- Ethereum mainnet 1, cutoff block 26257939. ENS identities were checked at current state around 24 October 2026 00:45 UTC, not historical ENS state.
- Exact lowercase 42-character address joins; successful positive-value native transfers. Native edges are undirected associations for path search, not a claim that the same funds flowed in sequence.
- Native normal histories for all 18 submitters: 30065 records, every page returned fewer than the 10,000-row cap. Roots reuse complete Base normal histories; four Ethereum root histories returned 448, 637, 117 and 21 records.
- Eight canonical Base USDC/WETH queries for AmirK, Mahnaz, Hellia and cd295 reached their final provider pages. This is not an all-token scan of all seven.
- Prior complete Collective Noun Transfer/delegation ledger reused. Prior internal histories for A/B/C/H remain capped at 4,000 each. Submitter internal histories were not exhaustively expanded.
- The graph yielded 606 root–intermediary–submitter combinations across 175 intermediaries. All 175 code reads succeeded at the Base cutoff: 169 had code; six had none. Contract creation metadata was retrieved for all 169; 21 deployed by subjects/submitters were investigated. Twenty-four selected purchase receipts were checked. Contract code alone is not proof of a public service.
- Ethereum internal transfers, other chains, private arrangements, arbitrary deeper paths and every possible creator/collector relation remain outside this bounded follow-up. Empty direct matches are not proof that no relationship exists.

## Wallet identities and ballot timing

| ID | Public alias | Full wallet / BaseScan | Yellow profile | UTC ballot time, Oct 23 | Allocated / budget |
|---|---|---|---|---|---|
| A | amirk.eth | [0xdc37e6f67bfb7361e25731fc477903e172d211f1](https://basescan.org/address/0xdc37e6f67bfb7361e25731fc477903e172d211f1) | [Profile](https://www.yellowcollective.art/profile/0xdc37e6f67bfb7361e25731fc477903e172d211f1) | 2026-10-23T19:50:44.033627+00:00 | 52 / 52 |
| B | mahnaz.eth | [0x0b81bffce9970aca9868120eee1bcc8de19119f7](https://basescan.org/address/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | [Profile](https://www.yellowcollective.art/profile/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | 2026-10-23T19:53:42.596167+00:00 | 53 / 53 |
| C | namirai.eth | [0xeb8a03b68e4f5ee0f02ff612915bfafba4902c00](https://basescan.org/address/0xeb8a03b68e4f5ee0f02ff612915bfafba4902c00) | [Profile](https://www.yellowcollective.art/profile/0xeb8a03b68e4f5ee0f02ff612915bfafba4902c00) | 2026-10-23T19:55:20.725556+00:00 | 51 / 51 |
| D | davingi.eth | [0x08165c34b6689a7b35ec1a57d1265f83e758240c](https://basescan.org/address/0x08165c34b6689a7b35ec1a57d1265f83e758240c) | [Profile](https://www.yellowcollective.art/profile/0x08165c34b6689a7b35ec1a57d1265f83e758240c) | 2026-10-23T20:16:42.380518+00:00 | 51 / 51 |
| E | moonza.eth | [0x07566caf069465977e9b0d3a96629c73a6c69740](https://basescan.org/address/0x07566caf069465977e9b0d3a96629c73a6c69740) | [Profile](https://www.yellowcollective.art/profile/0x07566caf069465977e9b0d3a96629c73a6c69740) | 2026-10-23T20:19:40.63423+00:00 | 51 / 51 |
| F | miniom.eth | [0xb15acc09c28226c7b47918f14951a65a0671ef3d](https://basescan.org/address/0xb15acc09c28226c7b47918f14951a65a0671ef3d) | [Profile](https://www.yellowcollective.art/profile/0xb15acc09c28226c7b47918f14951a65a0671ef3d) | 2026-10-23T20:22:51.776987+00:00 | 51 / 51 |
| G | desdot.eth | [0x31475a5652efbb267b3afdd9591ef05406db792b](https://basescan.org/address/0x31475a5652efbb267b3afdd9591ef05406db792b) | [Profile](https://www.yellowcollective.art/profile/0x31475a5652efbb267b3afdd9591ef05406db792b) | 2026-10-23T20:24:45.473238+00:00 | 51 / 51 |
| H | hellia.eth | [0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d](https://basescan.org/address/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | [Profile](https://www.yellowcollective.art/profile/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | Outside seven | See saved history |
| I | Unknown; cd295 is AmirK-associated inference | [0xcd295a33541d5aeb259c05ad51ef12b5e7fa30c1](https://basescan.org/address/0xcd295a33541d5aeb259c05ad51ef12b5e7fa30c1) | [Profile](https://www.yellowcollective.art/profile/0xcd295a33541d5aeb259c05ad51ef12b5e7fa30c1) | Outside seven | See saved history |

Identity sources: [ENS RPC results](ens-reverse.json), eight ens-*.json forward confirmations from official Etherscan MCP. A/B/H social links and biographies are self-published ENS text records. Separate names do not establish separate humans. cd295 has no forward-confirmed reverse name.

## Exact allocation matrix

| Entry | AmirK | Mahnaz | namirai | davingi | moonza | miniom | desdot | Group | All votes | Other voters |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Support Yellow Artists | 15 | 15 | 15 | 15 | 15 | 15 | 15 | 105 | 318 | 18 / 52 |
| Yellow🟡 The Culture We Own | 15 | 13 | 15 | 6 | 15 | 1 | 1 | 66 | 182 | 16 / 52 |
| We can make it! | 15 | 10 | 2 | 15 | 0 | 15 | 15 | 72 | 245 | 12 / 52 |
| 💛Paint the world Yellow💛 | 0 | 0 | 0 | 15 | 6 | 15 | 10 | 46 | 296 | 23 / 52 |
| Perpetual Collective Machine - Loop Animation | 0 | 15 | 15 | 0 | 0 | 5 | 10 | 45 | 300 | 24 / 52 |
| Free the DAO | 0 | 0 | 4 | 0 | 15 | 0 | 0 | 19 | 69 | 8 / 52 |
| FARCASTER EAT FIRST | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 74 | 11 / 52 |

All 22 active approved entries are in [baseline.json](baseline.json); the 15 omitted above received zero votes from the seven. Their 31 allocations sum to 360. All seven supported two entries; six supported We can make it!.

## Hellia’s full saved Rounds voting history

| Round | Entry | Votes | Submitter | UTC | DB allocation ID |
|---|---|---:|---|---|---|
| yellow-characters | Yellow Flamingo | 100 | [0xcb6eb9…7527](https://basescan.org/address/0xcb6eb98d0533dd42367cd064fc5b988814187527) | 2026-09-16T22:37:52.080Z | 6483ea11-bc5d-4669-909c-cab1edf11bfa |
| yellow-characters | Base yellow | 4 | [0xed764f…1476](https://basescan.org/address/0xed764f46c8b6e4ebeadb795017e436ddb3561476) | 2026-09-16T22:42:01.946Z | 9ef1d9ba-3c0b-4f12-a7b2-67bc29e5905c |
| propoganda | Support Yellow Artists | 15 | [0xcb6eb9…7527](https://basescan.org/address/0xcb6eb98d0533dd42367cd064fc5b988814187527) | 2026-10-20T13:45:13.105Z | d40748a6-e9b4-4b79-a8cc-a7d1bd8f7e4b |
| propoganda | Perpetual Collective Machine - Loop Animation | 5 | [pramadan.eth](https://basescan.org/address/0x1bae19af613bd5db94baf043d5817e16a53a4c33) | 2026-10-20T13:46:05.788Z | 42a516a1-942b-4a36-a2b0-de9dbb0599f1 |
| propoganda | Draw or Die! 🫀 by msmeghna | 15 | [0x15c6a4…3e7b](https://basescan.org/address/0x15c6a4bf9023ad20c51cbea9992a5bccf83f3e7b) | 2026-10-21T08:58:57.982Z | d9158d90-6638-4044-968a-c04d7118f7a9 |

Hellia is not counted among the seven. Seven + Hellia gave Support 120 votes (105 + 15). Hellia voted three days before the seven; its current-round voting total is 35. Historical total 139; 115 (82.7%) went to cb6 across the two rounds. Historical rules/caps differed: the September 100-vote allocation is a fact, not a cap violation finding.

## Verified NFT collecting relationships

Each row has a successful receipt with ERC-721 mint from zero to the buyer, and a separate official explorer contract-creation record identifying the deployer. Names were read from the collection at the cutoff. Values are native ETH sent with the mint, excluding gas; they do not show net creator proceeds. These are public art NFTs, not Collective Nouns.

| Buyer | Collection / token | Deployed by | UTC date | ETH | Mint evidence | Creation evidence |
|---|---|---|---|---:|---|---|
| [mahnaz.eth](https://basescan.org/address/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | The Nouns Machine #6077 | [pramadan.eth](https://basescan.org/address/0x1bae19af613bd5db94baf043d5817e16a53a4c33) | 2024-08-11T15:37:59.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0xfe264f0aa4a2d3100e8921a626c139a106507fbe14f7b5613790b9cf453918ce) | [Creation](https://basescan.org/tx/0xb791cf8bc471e587e92cc1c9dd1de2ee16738765cd8f9e3f52349cfcd10f9971) |
| [hellia.eth](https://basescan.org/address/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | Base Global Community #694 | [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | 2024-09-13T13:27:39.000Z | 0.0003 | [Transaction](https://basescan.org/tx/0xe1798a92fa444e393d68cbc4c392ae04afb3dd9ac445a30208c8f3e89d01809a) | [Creation](https://basescan.org/tx/0xd29bae853102939643a8604f7129c3588197eed556ceab941c82597973027431) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Eternal Summer #2444 | [amirk.eth](https://basescan.org/address/0xdc37e6f67bfb7361e25731fc477903e172d211f1) | 2024-09-13T23:38:17.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x5973a958562c6f0bf027b3d001089595459123b4655d4a94731664799c3b16ed) | [Creation](https://basescan.org/tx/0xd7413053e25eff396d88dad8b393752ce07fcd43818921204dca37fee5772e61) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Summer Vibe #1827 | [mahnaz.eth](https://basescan.org/address/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | 2024-09-14T21:09:57.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0xc38e40d6bc068a322d0d27444f1adad57208665efa7c2685d70e290bae2a33fa) | [Creation](https://basescan.org/tx/0xdff4c3b5334e2d1e7d11564d9cbbe35912a81fe9799729c7dc51fa486b68286f) |
| [mahnaz.eth](https://basescan.org/address/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | Base Global Community #1489 | [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | 2024-09-17T07:14:15.000Z | 0.0003 | [Transaction](https://basescan.org/tx/0xb1b63369d4af74cb445c3b070265dc4e040b10301d8510277973010423b9cb6c) | [Creation](https://basescan.org/tx/0xd29bae853102939643a8604f7129c3588197eed556ceab941c82597973027431) |
| [mahnaz.eth](https://basescan.org/address/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | Base Global Community #1490 | [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | 2024-09-17T07:25:33.000Z | 0.0003 | [Transaction](https://basescan.org/tx/0xb2916722edb01e3672a334dffe05c7efb62ff427c5dc9b95b665a1bef59e2428) | [Creation](https://basescan.org/tx/0xd29bae853102939643a8604f7129c3588197eed556ceab941c82597973027431) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Moonshell #782 | [hellia.eth](https://basescan.org/address/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | 2024-09-22T10:19:43.000Z | 0.00015 | [Transaction](https://basescan.org/tx/0xe7b1910ba58b88cf76596591c049b69eb24f54784b455a6068482fb8592754ad) | [Creation](https://basescan.org/tx/0x01307af8303ade9d12d65cde320dfa2a5019f12007065fd0117faf8e5ec8c436) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Cosmic Tote #429 | [hellia.eth](https://basescan.org/address/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | 2024-10-01T23:03:11.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x5d1dde6d54c0867408dd5afb78da25ff586faa95cc9faba31861a2c961676861) | [Creation](https://basescan.org/tx/0x5b408dc155fc6d260ee324a55bdab56f86085948f009fb84e98a7060033766c1) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Atomical #1957 | [hellia.eth](https://basescan.org/address/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | 2024-10-09T11:05:25.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x09ea6f1317bec30be1bf3f623b7175b91886320b3cc71ef7f730e61351ba6f2d) | [Creation](https://basescan.org/tx/0xc4a94a1c2947edb61db34b47c4270614724af0d81e427b330c9ac2280c4e17be) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Base World Vibe #1401 | [mahnaz.eth](https://basescan.org/address/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | 2024-10-09T11:12:43.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x4dbdba56ae2352bf7b501ccbf5433e399eedb085a2cb63709ff723082fa9f76e) | [Creation](https://basescan.org/tx/0xdb8f6c277ed4021130bd8bd7e83a15020b70c0387aaf55327c1aea92626bdab0) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Pacification #21 | [hellia.eth](https://basescan.org/address/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | 2024-10-10T22:35:33.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x1dc51ecae25362a469c633ed7ea0575f97a11052ed1970713748434a594ff1c1) | [Creation](https://basescan.org/tx/0xa2608a8a51fcec3bb5b25ede28b0f09d8bb2e6094301f5279c34bcca9e296f37) |
| [hellia.eth](https://basescan.org/address/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | Meditation : Redversion  #3 | [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | 2024-10-10T22:38:31.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x8263d95a6f3d2a30e0cee8bdc99f5266be71f07986cb005fc2892f7226da6caa) | [Creation](https://basescan.org/tx/0xd9a79bb9215bdf89ad2b12511dc57accb4b331a41b3c16d41236a59f38c1dab5) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Yellow Morning #766 | [amirk.eth](https://basescan.org/address/0xdc37e6f67bfb7361e25731fc477903e172d211f1) | 2024-10-15T10:53:55.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x2fca45ecc90d899a986e6aa72c431ac57ce0118c28469079b30f7a6eee900618) | [Creation](https://basescan.org/tx/0x6b65fbd59a15cfc71027a8c195b51ebf840b2937566d9324a50bfc5cef255399) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Yellow Morning #768 | [amirk.eth](https://basescan.org/address/0xdc37e6f67bfb7361e25731fc477903e172d211f1) | 2024-10-15T10:54:13.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x70098fb3775fb6d891e56e6e047045b93927eb67778cb12745590096a016dba5) | [Creation](https://basescan.org/tx/0x6b65fbd59a15cfc71027a8c195b51ebf840b2937566d9324a50bfc5cef255399) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Lumiflect #12 | [hellia.eth](https://basescan.org/address/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | 2024-10-16T23:57:55.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x325e120ea89bc97a599cfa6fc7a506c4d283d518855d4fbc05d7ae10bc4bfa5e) | [Creation](https://basescan.org/tx/0x37c5dbb6ba5713a5061af247948c592264b6f4e7fa6f41be638d19cce37e9a55) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Halloween Vibe #22 | [mahnaz.eth](https://basescan.org/address/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | 2024-10-26T18:03:27.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0xf2ec6e7893a46da03fa3828d98de8c456f5dd918fd640568fd2ac8f42763bead) | [Creation](https://basescan.org/tx/0x916ed6c9f44c2f852298be0fc118c14e38774806a212f6a958933ea9ec6524da) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Timeless Ink #566 | [mahnaz.eth](https://basescan.org/address/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | 2024-10-30T15:37:43.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x774cca2777a9f50df92c6fa0c4c21d5a19c2b83b8a3bd57730e8665f5f1e1b28) | [Creation](https://basescan.org/tx/0x7d62d286c3a4919be9b0ea18c63b3a95e1a4a40b4805c43f292219f5b7e9a367) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Liberation in the link #1066 | [amirk.eth](https://basescan.org/address/0xdc37e6f67bfb7361e25731fc477903e172d211f1) | 2024-11-11T22:25:57.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x1b399de5dd3e39bdead9e4bc945fe2e6cfc9abe56c9aa600f701bce09cf8ad0c) | [Creation](https://basescan.org/tx/0x825f64dab9911898972d485c3f14a617431022fad8d1a0f8c2e3a7c65a67d2f4) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Miggles' Midnight Thirst #1481 | [mahnaz.eth](https://basescan.org/address/0x0b81bffce9970aca9868120eee1bcc8de19119f7) | 2024-11-11T22:28:07.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x9af6be31ea03c0729a9b092eda5c962f6ec4589972e680b24345ddc9f9599b98) | [Creation](https://basescan.org/tx/0xf99171dcc9196eeca7abef39dd75fbcbf234eccc161d5e64456eeef62365106e) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Miggles' Midnight Madness #1470 | [amirk.eth](https://basescan.org/address/0xdc37e6f67bfb7361e25731fc477903e172d211f1) | 2024-11-11T22:28:29.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x83031238a345dd21afecd8d78e78e25835f058df68e2e34a7ec477f6af56bd24) | [Creation](https://basescan.org/tx/0xeb9bf1467112dfd02516fb167903c13c6b7e2d7b296205a96f6ed2281e6d2cf9) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Monster Miggles #1801 | [desdot.eth](https://basescan.org/address/0x31475a5652efbb267b3afdd9591ef05406db792b) | 2024-11-11T22:30:27.000Z | 0.0001 | [Transaction](https://basescan.org/tx/0x2b61998661ce1eeca990dbc31c1a4f3a4c093d8ae81bc2f3843df6f633b517de) | [Creation](https://basescan.org/tx/0x30139b19af4f0afa6c6820a6840cfb59a198dba97d1f2bc80aea8600a914b515) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Savanna Sovereigns #26 | [hellia.eth](https://basescan.org/address/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | 2024-12-02T20:36:29.000Z | 0.00015 | [Transaction](https://basescan.org/tx/0xbfb9dd9a078c12f800eefc7ec0246f9558819054d477b735f991c5bbefc8dd09) | [Creation](https://basescan.org/tx/0x5f335ee3291c2ce9116f1172b4f475abe8c7a40df7d6e1a0b3b17dc54c241579) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | Dreamlike Elephant #503 | [amirk.eth](https://basescan.org/address/0xdc37e6f67bfb7361e25731fc477903e172d211f1) | 2024-12-03T18:48:39.000Z | 0.00015 | [Transaction](https://basescan.org/tx/0xfc8d768de6be702eae33115b7cb57df2d47e1e330aaf9cd55244fda722c51a12) | [Creation](https://basescan.org/tx/0xddd0ab08fc4bd7281cedc95446e956179142550f5687df8bcababa755bdb2f49) |
| [redykay.eth](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | The Final Touch #12 | [hellia.eth](https://basescan.org/address/0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d) | 2024-12-26T13:19:15.000Z | 0.00015 | [Transaction](https://basescan.org/tx/0xfe6918c9086929898e95b1550e44f7121dc13d7ea8cde527a645b1b4b34992ff) | [Creation](https://basescan.org/tx/0x36b9b51e4ed07b904dc59b3e9781fc09d1034adcf58ce6a43d790dec1983530a) |

Redykay: 19 mints across 18 collections, deployed by hellia.eth: 7 mints / 7 collections; amirk.eth: 6 mints / 5 collections; mahnaz.eth: 5 mints / 5 collections; desdot.eth: 1 mints / 1 collections. Public minting can show familiarity or support; it does not establish private control. Only AmirK gave Redykay votes in this seven-wallet set.

## cd295 ↔ AmirK on Ethereum

| UTC | Direction | ETH | Evidence |
|---|---|---:|---|
| 2025-02-27T07:02:59.000Z | 0xcd295a…30c1 → amirk.eth | 0.04 | [Transaction](https://etherscan.io/tx/0x015c6ec85a35b9e86340b0545e716b837728048de9a767eae8d60d31ed9bac36) |
| 2025-03-06T08:59:59.000Z | amirk.eth → 0xcd295a…30c1 | 0.05 | [Transaction](https://etherscan.io/tx/0x9268cff7868c40dcaa0d3318670aca09b0ac9efbe172e7a508982a78b5e8e920) |
| 2025-05-18T11:48:35.000Z | 0xcd295a…30c1 → amirk.eth | 0.1 | [Transaction](https://etherscan.io/tx/0xe5cac1e420c9aef86d28343edd75034062739e0253ef85d917cc08b37c6be868) |
| 2025-06-02T19:17:11.000Z | 0xcd295a…30c1 → amirk.eth | 0.299 | [Transaction](https://etherscan.io/tx/0x14136be2ba005d7077572d64effe6817e0e053e77affb4c1f6401130c91bbbe1) |
| 2025-07-07T06:00:59.000Z | 0xcd295a…30c1 → amirk.eth | 0.1 | [Transaction](https://etherscan.io/tx/0xc249793b22254631aef8f18b3d298cfd4349aeef64de6efb70429d2331348a5a) |
| 2025-07-15T11:18:23.000Z | 0xcd295a…30c1 → amirk.eth | 0.1 | [Transaction](https://etherscan.io/tx/0x78d28d342d30ffd226dcac593b9d121507bd42317c77a8197a9f7fe222e5c3d3) |
| 2025-08-12T12:34:35.000Z | 0xcd295a…30c1 → amirk.eth | 0.1 | [Transaction](https://etherscan.io/tx/0xbb755d17168a55658e4b3d91ffc14e41183509dcecf55d83aa97bc4dc3ff380b) |
| 2025-08-15T11:21:23.000Z | 0xcd295a…30c1 → amirk.eth | 0.1 | [Transaction](https://etherscan.io/tx/0x20b2c5f8cb283799231a54e29be064f8a5c41ae81c88f7d2ef202cad7ee7fe8e) |
| 2025-08-15T11:25:35.000Z | 0xcd295a…30c1 → amirk.eth | 0.3 | [Transaction](https://etherscan.io/tx/0x955bfff801aa3ba47d86d6cfaa8057259fddb20546ce0fb810b16b0e3f1ecddf) |
| 2025-08-17T06:16:47.000Z | 0xcd295a…30c1 → amirk.eth | 0.000783275242028877 | [Transaction](https://etherscan.io/tx/0x63c5eb0ddb4f0c1807d6bfbfad6aa281ff6a436cfbecf957b0aaf970e4446e23) |

The full ledger includes tiny transfers from lookalike dc37 addresses. They are NOT AmirK and were excluded from this count. First funding of miniom on Base is linked in the [prior evidence appendix](../seven-wallet-cluster-2026-10-24T00-08-23-115Z/evidence-appendix.md).

## Indirect matches that do not establish ownership

- First place cb6: three two-step paths (AmirK/Mahnaz/Hellia), all through RelayReceiver 0xa5f565650890fba1824ee0f21ebbbf660a179934. Prior verified-source evidence identifies this public contract.
- cd295: two paths, to Redykay and kimmydeuk, through the previously verified Across SpokePool 0x09aea4b2242abc8bb4bb78d537a67a245a7bec64.
- 0xf70da97812cb96acdf810712aa562db8dfa3dbef is explorer-labelled [Relay: Solver](https://blockscan.com/Address/0xf70da97812cb96acdf810712aa562db8dfa3dbef). Its broad service use is not a common private funder.
- 0x770b642da2960b96851fc1cf9674df6798e24dfa: the newest 1,000-row sample contains 998 identical 0.000776999999999999 ETH payments. This looks like mass distribution; operator and purpose remain unknown.
- Four other code-free intermediaries (ada5bb90…, 0ec4e45f…, d782268f…, 23fb4119…) have 1,000-row samples showing 132–252 distinct outgoing recipients and routing/multicall operations. Service-like activity is an inference; operator names were not verified. They are not treated as private owner links.
- Do not label every shared contract harmless solely because it has code. The creator-metadata step above recovered genuine collecting relationships from that group. Remaining shared contracts are catalogued in two-hop-paths.json, not fully attributed to people.

## All submitters checked

| Wallet | Public alias/profile if known | Approved current entries |
|---|---|---|
| [0xa09aa75da763d4aeb692672897c057786cdd258b](https://basescan.org/address/0xa09aa75da763d4aeb692672897c057786cdd258b) | trvkc.eth | Yellow🟡 The Culture We Own |
| [0x215db99298af65306a4c60bd3b7612d5f60b03d7](https://basescan.org/address/0x215db99298af65306a4c60bd3b7612d5f60b03d7) | nadiecito.eth | TOO MUCH SLOP; Free the DAO; Make Art Great Again |
| [0xfb1bbff3747b6090fce6c171ef9bfc2298ad3bd6](https://basescan.org/address/0xfb1bbff3747b6090fce6c171ef9bfc2298ad3bd6) | Latif | On-chain Art for All |
| [0x15c6a4bf9023ad20c51cbea9992a5bccf83f3e7b](https://basescan.org/address/0x15c6a4bf9023ad20c51cbea9992a5bccf83f3e7b) | Unknown | Draw or Die! 🫀 by msmeghna |
| [0xed764f46c8b6e4ebeadb795017e436ddb3561476](https://basescan.org/address/0xed764f46c8b6e4ebeadb795017e436ddb3561476) | momotsuki | Less Talk. Make More |
| [0x6681aba8a0ec9f26846e1fc1231994a42d0dea6b](https://basescan.org/address/0x6681aba8a0ec9f26846e1fc1231994a42d0dea6b) | Unknown | Creative Freedom 🪽 |
| [0x9ab51fd89f163d07127df192b615356d53b406f6](https://basescan.org/address/0x9ab51fd89f163d07127df192b615356d53b406f6) | valentinaart.eth | 💛Paint the world Yellow💛 |
| [0x4e0658e1e379faf0b96b78cfe7051f87c07900e2](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | redykay.eth | FARCASTER EAT FIRST |
| [0xcb6eb98d0533dd42367cd064fc5b988814187527](https://basescan.org/address/0xcb6eb98d0533dd42367cd064fc5b988814187527) | Unknown | Support Yellow Artists |
| [0x8661ee79c9ec060bd263f41420ff1b4a36bb3ce8](https://basescan.org/address/0x8661ee79c9ec060bd263f41420ff1b4a36bb3ce8) | 0xdiablo | More Art, Less Algorithm |
| [0xc19f77dd0781605b2f551cfbfb3161ff2d7e93c8](https://basescan.org/address/0xc19f77dd0781605b2f551cfbfb3161ff2d7e93c8) | Unknown | Road to Yellow |
| [0x1ba77f0359fb0e0c13a93ba284a084da2122e957](https://basescan.org/address/0x1ba77f0359fb0e0c13a93ba284a084da2122e957) | Skwalo_09 | Keep the yellow spirit! |
| [0x46978b8e5f2d1e6e077d35047337b4fcc18d4079](https://basescan.org/address/0x46978b8e5f2d1e6e077d35047337b4fcc18d4079) | Unknown | Build the culture |
| [0x1bae19af613bd5db94baf043d5817e16a53a4c33](https://basescan.org/address/0x1bae19af613bd5db94baf043d5817e16a53a4c33) | pramadan.eth | Perpetual Collective Machine - Loop Animation |
| [0x5ce3e4c14fec4bf6d6fe942828b65785026c069b](https://basescan.org/address/0x5ce3e4c14fec4bf6d6fe942828b65785026c069b) | Unknown | The Culture Is the Currency |
| [0x72d4e991040e3b65fddbe5f340f65cf03c506e6f](https://basescan.org/address/0x72d4e991040e3b65fddbe5f340f65cf03c506e6f) | kimmydeuk.eth | YELLOW IS EVERYWHERE |
| [0x7802cc411bfe02655fadfa5b23f9db3382d84a44](https://basescan.org/address/0x7802cc411bfe02655fadfa5b23f9db3382d84a44) | Unknown | This Could Have Been a Mural; We can make it!; The Museum Has No Front Desk |
| [0x8ec956961cc68313dc67237376ed16f6721a46b6](https://basescan.org/address/0x8ec956961cc68313dc67237376ed16f6721a46b6) | Unknown | Yellow |

## Reproduction and evidence files

- analyze-baseline.cjs: exact database address joins and matrix.
- analyze-extended.cjs: direct-match and Ethereum/native/token summaries; no production requests.
- analyze-paths.cjs: bounded Base two-hop native associations.
- classify-paths.cjs: pinned public eth_getCode reads.
- verify-collectors.cjs: saved receipt decoding plus pinned collection-name reads.
- build-report.cjs: local calculations, Markdown/CSV outputs and assertions.
- Source JSON: baseline, extended-analysis, ens-*, Ethereum/Base/submitter histories, peer-creators-*, collector-receipt-*, collector-connections, two-hop-paths, intermediary-code, peer-sample-*.
- [Claim ledger](claim-ledger.json) · [Verification](verification.json) · [Prior NFT acquisition timeline](../seven-wallet-cluster-2026-10-24T00-08-23-115Z/nft-timeline.csv).

No production writes, vote removals, disqualifications, public accusations or onchain transactions were executed.
