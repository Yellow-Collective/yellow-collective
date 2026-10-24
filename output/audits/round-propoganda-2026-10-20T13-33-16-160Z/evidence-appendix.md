# Evidence appendix — Yellow Propoganda

Round: e7c5cc86-dbc3-43fc-8ff1-795d4b997c33 / propoganda. Database cutoff: 2026-10-20T13:33:16.160Z. Chain: Base 8453, contract 0x220e41499cf4d93a3629a5509410cbf9e6e0b109. Code revision: a4b697cbdf50d53f56bf3935431f754d2c83446d. Local source was inspected; deployed source parity was not independently established.

## Reproduction

From repository root, run the saved active-round collector through Railway with explicit production identifiers:

`railway run --project af512d4f-60b5-42a8-b7dc-bf337fa00c1d --environment production --service 9472c187-a023-46d2-b39e-4f42a88d3b51 --no-local -- node output/audits/propoganda-active-tooling/collect-active.cjs --round propoganda`

This collector explicitly permits an active round for this request. DB TLS verifies the service CA plus an exact leaf-certificate pin, both retrieved from the named service through user-approved SSH. The certificate has localhost as its hostname, so the authenticated service certificate pin supplies service identity. rejectUnauthorized remains true. No DB credentials were saved. Temporary audit SSH registration was revoked after certificate retrieval. The pre-existing public SSH key registration and approved Railway known-host entry remain.

The collector writes a fresh UTC folder. Saved chain collection/analysis scripts use this audit's explicit folder; select the new cutoff folder before a new run. collect-rpc-full.cjs scans genesis through the cutoff; collect-rpc.cjs was an exploratory cached-history delta and is not the final history source. An older file supplies only a binary-search lower bound in the final collector; final events come entirely from fresh RPC reads.

## Rules

DB: base_plus_voting_power; base votes 50; per-entry cap 15; voting_start snapshot 52697526. Historical getVotes must be positive. Budget is 50 + getVotes. Source: utils/rounds/getRoundVotingPower.ts and utils/rounds/getCollectiveNounVotingPower.ts. data/rounds.ts rejects same-address self-votes and allocations to deleted/unapproved entries. This audit does not infer that every transferred NFT or delegation violates a round rule. Stored round text was preserved in database-snapshot.json.

## Material delegation receipts

- [0x302072f37a511d291ec55a62c0c0144c64eee30a170e5f52ba4150dc70c1f6bd](https://basescan.org/tx/0x302072f37a511d291ec55a62c0c0144c64eee30a170e5f52ba4150dc70c1f6bd) — status 0x1; matched raw event logs.
- [0x8319862d4209259774f4a86a2afa7b78db00392191853312515e2a6aa5b52891](https://basescan.org/tx/0x8319862d4209259774f4a86a2afa7b78db00392191853312515e2a6aa5b52891) — status 0x1; matched raw event logs.
- [0x21a7c70b19ca85b708ffbb9e7c7a10b67e162a43a61739a4e477d982f556ae63](https://basescan.org/tx/0x21a7c70b19ca85b708ffbb9e7c7a10b67e162a43a61739a4e477d982f556ae63) — status 0x1; matched raw event logs.
- [0x31f6c5a24f4130766d2ef487e3b947bdbc18efb1488b91c6de216d893712f761](https://basescan.org/tx/0x31f6c5a24f4130766d2ef487e3b947bdbc18efb1488b91c6de216d893712f761) — status 0x1; matched raw event logs.
- [0x6e792833e8aa18195c22523b782038b8577de0e3ab57ea70eca12315839729d3](https://basescan.org/tx/0x6e792833e8aa18195c22523b782038b8577de0e3ab57ea70eca12315839729d3) — status 0x1; matched raw event logs.

## Every participant

| Wallet | Yellow profile | BaseScan |
|---|---|---|
| 0x003276c5c24cdaff1d804170ab5cbb914f51f78a | [Profile](https://www.yellowcollective.art/profile/0x003276c5c24cdaff1d804170ab5cbb914f51f78a) | [BaseScan](https://basescan.org/address/0x003276c5c24cdaff1d804170ab5cbb914f51f78a) |
| 0x036cd064d068eb1d99e07d79848c7a4aab94bd49 | [Profile](https://www.yellowcollective.art/profile/0x036cd064d068eb1d99e07d79848c7a4aab94bd49) | [BaseScan](https://basescan.org/address/0x036cd064d068eb1d99e07d79848c7a4aab94bd49) |
| 0x15c6a4bf9023ad20c51cbea9992a5bccf83f3e7b | [Profile](https://www.yellowcollective.art/profile/0x15c6a4bf9023ad20c51cbea9992a5bccf83f3e7b) | [BaseScan](https://basescan.org/address/0x15c6a4bf9023ad20c51cbea9992a5bccf83f3e7b) |
| 0x1ba77f0359fb0e0c13a93ba284a084da2122e957 | [Profile](https://www.yellowcollective.art/profile/0x1ba77f0359fb0e0c13a93ba284a084da2122e957) | [BaseScan](https://basescan.org/address/0x1ba77f0359fb0e0c13a93ba284a084da2122e957) |
| 0x1bae19af613bd5db94baf043d5817e16a53a4c33 | [Profile](https://www.yellowcollective.art/profile/0x1bae19af613bd5db94baf043d5817e16a53a4c33) | [BaseScan](https://basescan.org/address/0x1bae19af613bd5db94baf043d5817e16a53a4c33) |
| 0x215db99298af65306a4c60bd3b7612d5f60b03d7 | [Profile](https://www.yellowcollective.art/profile/0x215db99298af65306a4c60bd3b7612d5f60b03d7) | [BaseScan](https://basescan.org/address/0x215db99298af65306a4c60bd3b7612d5f60b03d7) |
| 0x2262d4288f35b75831f0b132a7b1fcf719430274 | [Profile](https://www.yellowcollective.art/profile/0x2262d4288f35b75831f0b132a7b1fcf719430274) | [BaseScan](https://basescan.org/address/0x2262d4288f35b75831f0b132a7b1fcf719430274) |
| 0x282d656a9d95c64522f6bc1a42ee759de81e8dc0 | [Profile](https://www.yellowcollective.art/profile/0x282d656a9d95c64522f6bc1a42ee759de81e8dc0) | [BaseScan](https://basescan.org/address/0x282d656a9d95c64522f6bc1a42ee759de81e8dc0) |
| 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a | [Profile](https://www.yellowcollective.art/profile/0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a) | [BaseScan](https://basescan.org/address/0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a) |
| 0x3ba02da5b9fe77aed5592e934f7ec15381b3dded | [Profile](https://www.yellowcollective.art/profile/0x3ba02da5b9fe77aed5592e934f7ec15381b3dded) | [BaseScan](https://basescan.org/address/0x3ba02da5b9fe77aed5592e934f7ec15381b3dded) |
| 0x46978b8e5f2d1e6e077d35047337b4fcc18d4079 | [Profile](https://www.yellowcollective.art/profile/0x46978b8e5f2d1e6e077d35047337b4fcc18d4079) | [BaseScan](https://basescan.org/address/0x46978b8e5f2d1e6e077d35047337b4fcc18d4079) |
| 0x4a90f5a9401158a70f5f307aa13ff0b0e62c7b51 | [Profile](https://www.yellowcollective.art/profile/0x4a90f5a9401158a70f5f307aa13ff0b0e62c7b51) | [BaseScan](https://basescan.org/address/0x4a90f5a9401158a70f5f307aa13ff0b0e62c7b51) |
| 0x4d1fd46f87449ffe235e3fce21df8a9bf8bd9206 | [Profile](https://www.yellowcollective.art/profile/0x4d1fd46f87449ffe235e3fce21df8a9bf8bd9206) | [BaseScan](https://basescan.org/address/0x4d1fd46f87449ffe235e3fce21df8a9bf8bd9206) |
| 0x4e0658e1e379faf0b96b78cfe7051f87c07900e2 | [Profile](https://www.yellowcollective.art/profile/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | [BaseScan](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) |
| 0x4e2a3a65d0e2bcdb507a70fe2d3fc5dff464aa25 | [Profile](https://www.yellowcollective.art/profile/0x4e2a3a65d0e2bcdb507a70fe2d3fc5dff464aa25) | [BaseScan](https://basescan.org/address/0x4e2a3a65d0e2bcdb507a70fe2d3fc5dff464aa25) |
| 0x517186eefab9d631e7ddbed521740e84afd9b11f | [Profile](https://www.yellowcollective.art/profile/0x517186eefab9d631e7ddbed521740e84afd9b11f) | [BaseScan](https://basescan.org/address/0x517186eefab9d631e7ddbed521740e84afd9b11f) |
| 0x5ce3e4c14fec4bf6d6fe942828b65785026c069b | [Profile](https://www.yellowcollective.art/profile/0x5ce3e4c14fec4bf6d6fe942828b65785026c069b) | [BaseScan](https://basescan.org/address/0x5ce3e4c14fec4bf6d6fe942828b65785026c069b) |
| 0x5d69c42a3a481d0ccfd88cfa8a2a08e2bf456134 | [Profile](https://www.yellowcollective.art/profile/0x5d69c42a3a481d0ccfd88cfa8a2a08e2bf456134) | [BaseScan](https://basescan.org/address/0x5d69c42a3a481d0ccfd88cfa8a2a08e2bf456134) |
| 0x5eaa352f438023f956f8e6bd581f37a67971e46b | [Profile](https://www.yellowcollective.art/profile/0x5eaa352f438023f956f8e6bd581f37a67971e46b) | [BaseScan](https://basescan.org/address/0x5eaa352f438023f956f8e6bd581f37a67971e46b) |
| 0x6681aba8a0ec9f26846e1fc1231994a42d0dea6b | [Profile](https://www.yellowcollective.art/profile/0x6681aba8a0ec9f26846e1fc1231994a42d0dea6b) | [BaseScan](https://basescan.org/address/0x6681aba8a0ec9f26846e1fc1231994a42d0dea6b) |
| 0x7234c36a71ec237c2ae7698e8916e0735001e9af | [Profile](https://www.yellowcollective.art/profile/0x7234c36a71ec237c2ae7698e8916e0735001e9af) | [BaseScan](https://basescan.org/address/0x7234c36a71ec237c2ae7698e8916e0735001e9af) |
| 0x72d4e991040e3b65fddbe5f340f65cf03c506e6f | [Profile](https://www.yellowcollective.art/profile/0x72d4e991040e3b65fddbe5f340f65cf03c506e6f) | [BaseScan](https://basescan.org/address/0x72d4e991040e3b65fddbe5f340f65cf03c506e6f) |
| 0x7802cc411bfe02655fadfa5b23f9db3382d84a44 | [Profile](https://www.yellowcollective.art/profile/0x7802cc411bfe02655fadfa5b23f9db3382d84a44) | [BaseScan](https://basescan.org/address/0x7802cc411bfe02655fadfa5b23f9db3382d84a44) |
| 0x8661ee79c9ec060bd263f41420ff1b4a36bb3ce8 | [Profile](https://www.yellowcollective.art/profile/0x8661ee79c9ec060bd263f41420ff1b4a36bb3ce8) | [BaseScan](https://basescan.org/address/0x8661ee79c9ec060bd263f41420ff1b4a36bb3ce8) |
| 0x8ec956961cc68313dc67237376ed16f6721a46b6 | [Profile](https://www.yellowcollective.art/profile/0x8ec956961cc68313dc67237376ed16f6721a46b6) | [BaseScan](https://basescan.org/address/0x8ec956961cc68313dc67237376ed16f6721a46b6) |
| 0x8f3a83a3356d2666d89d027544bbaffa12139e3c | [Profile](https://www.yellowcollective.art/profile/0x8f3a83a3356d2666d89d027544bbaffa12139e3c) | [BaseScan](https://basescan.org/address/0x8f3a83a3356d2666d89d027544bbaffa12139e3c) |
| 0x9234ccdea92b38071458b6837bddbddd874bfc26 | [Profile](https://www.yellowcollective.art/profile/0x9234ccdea92b38071458b6837bddbddd874bfc26) | [BaseScan](https://basescan.org/address/0x9234ccdea92b38071458b6837bddbddd874bfc26) |
| 0x97c8b754a6956832e56b3958943d0ce47fde4665 | [Profile](https://www.yellowcollective.art/profile/0x97c8b754a6956832e56b3958943d0ce47fde4665) | [BaseScan](https://basescan.org/address/0x97c8b754a6956832e56b3958943d0ce47fde4665) |
| 0x9ab51fd89f163d07127df192b615356d53b406f6 | [Profile](https://www.yellowcollective.art/profile/0x9ab51fd89f163d07127df192b615356d53b406f6) | [BaseScan](https://basescan.org/address/0x9ab51fd89f163d07127df192b615356d53b406f6) |
| 0x9ffaab6c24d4fb58d61b26b08c8795e9e323f28b | [Profile](https://www.yellowcollective.art/profile/0x9ffaab6c24d4fb58d61b26b08c8795e9e323f28b) | [BaseScan](https://basescan.org/address/0x9ffaab6c24d4fb58d61b26b08c8795e9e323f28b) |
| 0xa09aa75da763d4aeb692672897c057786cdd258b | [Profile](https://www.yellowcollective.art/profile/0xa09aa75da763d4aeb692672897c057786cdd258b) | [BaseScan](https://basescan.org/address/0xa09aa75da763d4aeb692672897c057786cdd258b) |
| 0xa2746b2a56f9886925c03af1d1e10b8b3dfbbe29 | [Profile](https://www.yellowcollective.art/profile/0xa2746b2a56f9886925c03af1d1e10b8b3dfbbe29) | [BaseScan](https://basescan.org/address/0xa2746b2a56f9886925c03af1d1e10b8b3dfbbe29) |
| 0xa4ec1315f1032b0dd3c5043d3d145f93ec4d009f | [Profile](https://www.yellowcollective.art/profile/0xa4ec1315f1032b0dd3c5043d3d145f93ec4d009f) | [BaseScan](https://basescan.org/address/0xa4ec1315f1032b0dd3c5043d3d145f93ec4d009f) |
| 0xa87daa2bc3bd0ecca4c9111776bab2c9d44d6c6b | [Profile](https://www.yellowcollective.art/profile/0xa87daa2bc3bd0ecca4c9111776bab2c9d44d6c6b) | [BaseScan](https://basescan.org/address/0xa87daa2bc3bd0ecca4c9111776bab2c9d44d6c6b) |
| 0xac1a6f43425efdd808748a6eb992fa047e90776e | [Profile](https://www.yellowcollective.art/profile/0xac1a6f43425efdd808748a6eb992fa047e90776e) | [BaseScan](https://basescan.org/address/0xac1a6f43425efdd808748a6eb992fa047e90776e) |
| 0xae4705dc0816ee6d8a13f1c72780ec5021915fed | [Profile](https://www.yellowcollective.art/profile/0xae4705dc0816ee6d8a13f1c72780ec5021915fed) | [BaseScan](https://basescan.org/address/0xae4705dc0816ee6d8a13f1c72780ec5021915fed) |
| 0xba8e0841cd9a95c80ccbd502b08f73f8e30f2186 | [Profile](https://www.yellowcollective.art/profile/0xba8e0841cd9a95c80ccbd502b08f73f8e30f2186) | [BaseScan](https://basescan.org/address/0xba8e0841cd9a95c80ccbd502b08f73f8e30f2186) |
| 0xc19f77dd0781605b2f551cfbfb3161ff2d7e93c8 | [Profile](https://www.yellowcollective.art/profile/0xc19f77dd0781605b2f551cfbfb3161ff2d7e93c8) | [BaseScan](https://basescan.org/address/0xc19f77dd0781605b2f551cfbfb3161ff2d7e93c8) |
| 0xc578958dd1880cf00bffbb7feb9c28cbbbcad3bf | [Profile](https://www.yellowcollective.art/profile/0xc578958dd1880cf00bffbb7feb9c28cbbbcad3bf) | [BaseScan](https://basescan.org/address/0xc578958dd1880cf00bffbb7feb9c28cbbbcad3bf) |
| 0xc78d75b064848e70c365e7a49867c81cfab23e54 | [Profile](https://www.yellowcollective.art/profile/0xc78d75b064848e70c365e7a49867c81cfab23e54) | [BaseScan](https://basescan.org/address/0xc78d75b064848e70c365e7a49867c81cfab23e54) |
| 0xcb6eb98d0533dd42367cd064fc5b988814187527 | [Profile](https://www.yellowcollective.art/profile/0xcb6eb98d0533dd42367cd064fc5b988814187527) | [BaseScan](https://basescan.org/address/0xcb6eb98d0533dd42367cd064fc5b988814187527) |
| 0xcba18cb7e7c043b378e21607fa104f1767442348 | [Profile](https://www.yellowcollective.art/profile/0xcba18cb7e7c043b378e21607fa104f1767442348) | [BaseScan](https://basescan.org/address/0xcba18cb7e7c043b378e21607fa104f1767442348) |
| 0xceed9585854f12f81a0103861b83b995a64ad915 | [Profile](https://www.yellowcollective.art/profile/0xceed9585854f12f81a0103861b83b995a64ad915) | [BaseScan](https://basescan.org/address/0xceed9585854f12f81a0103861b83b995a64ad915) |
| 0xdcf37d8aa17142f053aaa7dc56025ab00d897a19 | [Profile](https://www.yellowcollective.art/profile/0xdcf37d8aa17142f053aaa7dc56025ab00d897a19) | [BaseScan](https://basescan.org/address/0xdcf37d8aa17142f053aaa7dc56025ab00d897a19) |
| 0xdd3b3a67c66a5276aacc499ec2abd5241721e008 | [Profile](https://www.yellowcollective.art/profile/0xdd3b3a67c66a5276aacc499ec2abd5241721e008) | [BaseScan](https://basescan.org/address/0xdd3b3a67c66a5276aacc499ec2abd5241721e008) |
| 0xe212d2ca76e29c0d3a8ebfb665abf4679535df27 | [Profile](https://www.yellowcollective.art/profile/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) | [BaseScan](https://basescan.org/address/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) |
| 0xe348b541dd51c5e7b32557f055f7205e6d8c0a6d | [Profile](https://www.yellowcollective.art/profile/0xe348b541dd51c5e7b32557f055f7205e6d8c0a6d) | [BaseScan](https://basescan.org/address/0xe348b541dd51c5e7b32557f055f7205e6d8c0a6d) |
| 0xed764f46c8b6e4ebeadb795017e436ddb3561476 | [Profile](https://www.yellowcollective.art/profile/0xed764f46c8b6e4ebeadb795017e436ddb3561476) | [BaseScan](https://basescan.org/address/0xed764f46c8b6e4ebeadb795017e436ddb3561476) |
| 0xef1b8fa58e790310a56736bce71f1f658d905d36 | [Profile](https://www.yellowcollective.art/profile/0xef1b8fa58e790310a56736bce71f1f658d905d36) | [BaseScan](https://basescan.org/address/0xef1b8fa58e790310a56736bce71f1f658d905d36) |
| 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4 | [Profile](https://www.yellowcollective.art/profile/0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4) | [BaseScan](https://basescan.org/address/0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4) |
| 0xf7aef946d3f2e58a3685166ace1fc3db76d614de | [Profile](https://www.yellowcollective.art/profile/0xf7aef946d3f2e58a3685166ace1fc3db76d614de) | [BaseScan](https://basescan.org/address/0xf7aef946d3f2e58a3685166ace1fc3db76d614de) |
| 0xfb1bbff3747b6090fce6c171ef9bfc2298ad3bd6 | [Profile](https://www.yellowcollective.art/profile/0xfb1bbff3747b6090fce6c171ef9bfc2298ad3bd6) | [BaseScan](https://basescan.org/address/0xfb1bbff3747b6090fce6c171ef9bfc2298ad3bd6) |

## Verification

See audit-validation.json for counts, exclusions, supply/burn reconciliation, snapshot voting power, exact range coverage and receipt matches. Event ranges are comfortably below 1,000 logs each (largest 341); no offset pagination was needed. No evidence of omitted logs was found in state reconciliation, although a single RPC aggregator is not independent proof of every historical event.
