# Comic Strips voting audit

## Findings and primary recommendation

**Do not delete votes or disqualify an entry on the present evidence. Review the five highest-priority allocations (125 votes) before awarding prizes.** Request factual explanations of who controlled the voting wallets, then apply the self-vote rule consistently. Also review cba's 22 Candleman votes and the NFT 355 pair's 202 votes, at lower priority. No participants were contacted. No person is identified as a culprit.

1. **Recommended removals: none yet.** All 219 current allocations satisfy recorded historical eligibility, wallet budgets and cap 25; no direct same-address self-votes, duplicate allocations, orphaned records, unavailable targets or out-of-window creation times were found.
2. **Recommended disqualifications: none.** Rise, Candleman and Yellow Tattoo require review before awarding; transfers, loans, delegation or coordinated support are not independently prohibited by any rule located in deployed source or stored round content. No proven common control or deliberate manipulation.
3. **Accounts requiring explanation:** the addresses in findings F01-F05 below. Five acute allocations total 125; all 16 review allocations total 349. REVIEW is not a finding that votes are invalid.
4. **Prize effects, conditional:** removing the acute 125 changes first place from Candleman 350 to Fire Safety 334. Candleman becomes325/second; Rise 277/third. Tattoo 134 becomes84/14th and loses its NFT award; Pirate 125 rises to10th. Observed winners remain unchanged because no moderation was executed.
5. **Evidence that could change this:** signing-wallet control at the relevant times; gift/sale/custody explanation; published rules applicable when voting occurred; authorized account linkage; a configuration or admin history not represented by current rows.

## Environment and cutoff

- Audit started 2026-10-01 20:49:36 UTC /16:49:36 EDT. Voting ended 2026-10-01 21:00 UTC /17:00 EDT.
- Final database cutoff **2026-10-01T21:00:49.253Z**; chain cutoff block 52049551, 2026-10-01T21:00:49.000Z, hash 0x45d0bcbee575e0867c51e3ca3284289d3a9ed8ba9786f16c895a72608c6540ce. All result calculations use this single snapshot.
- Actual Railway database is **BuilderOS / production / Postgres**, project af512d4f-60b5-42a8-b7dc-bf337fa00c1d, service 9472c187-a023-46d2-b39e-4f42a88d3b51, host gondola.proxy.rlwy.net; database railway. The separately named Yellow Collective Railway database contains demos. Exact live round/submission/vote IDs match the supplied prior production leads.
- Round c9569c28-f599-47cb-8dc3-31e890b977da, slug comic-strips. Vercel production identity and deployment history are saved in deployment-identity.json/deployment-history.json. Source at ae8340d6072607efe69ef4878663d1ab877d0fbf and pre-snapshot 6dd21342274d7dfb73bcb2e1ce2fd2a3a9a73033 has no voting-file differences. Unrelated dirty local code was preserved.
- No production application GET was called: public detail GET finalizes winners; voting power GET can persist snapshots; DB helpers run migrations/backfills. All production DB reads used REPEATABLE READ READ ONLY and ROLLBACK.
- Public UI/API parity was not freshly verified because of those writes. This is a verified live DB ledger, not a claim of fresh UI agreement.

## Verified rules and ledger

Snapshot target Sep24 18:20 UTC selected block 51742326 (2026-09-24T18:19:59.000Z); hash 0xd5876e8fd8dd56a6dec87e5af3a2f3ff75e6f632ceb7367b4c154fff4d330c9d. Strategy base_plus_voting_power: **getVotes>0 makes capacity 100+getVotes; zero makes capacity 0.** NFT ownership by itself does not determine eligibility. Cap 25 per wallet per entry. The deployed UI says “You cannot vote for your own entry”; API implements address equality. The stored round text has no specific NFT loan, Sybil, coordinated voting or disqualification terms. External published terms remain unverified.

| Metric | Result |
| --- | --- |
| votes | 219 |
| voters | 32 |
| participants | 43 |
| submissions | 20 |
| totalVotes | 2919 |
| transferEvents | 2192 |
| uniqueTokens | 960 |
| otherRoundVoteRows | 352 |
| otherRoundSubmissionRows | 108 |
| adminAuditRows | 0 |
| winnerRows | 10 |
| highPriorityReviewedAllocations | 5 |
| highPriorityReviewedVotes | 125 |
| allReviewedAllocations | 16 |
| allReviewedVotes | 349 |
| retainedAllocations | 203 |
| technicalAnomalies | 0 |
| receiptTransactionsVerified | 86 |
| beforeAfterEventsVerified | 13 |

Snapshot supply 831 and cutoff supply 837 match reconstructed supply; all successful historical ownerOf checks match reconstructed ownership. Two snapshot ownerOf failures for tokens 955/959 are expected because those tokens were minted later. Zero ownership disagreements. Historical state for all 43 participants was successfully read.

Preclose and postclose snapshots have identical 219 allocation rows and2919 votes. Before close there were zero winner rows; after close there were 10, finalized at 2026-10-01T21:00:05.327Z. That was external application activity, not this audit. No admin audit rows were present. Normal increments overwrite totals and preserve created_at; their individual histories cannot be reconstructed from current rows.

## Likely submitter associations and possible wallet owners

**The strongest candidate submitter associations are Rise → 79ed/b897, Candleman → 3b/cba, and Yellow Tattoo → ac1/f7.** These identify whose activity should be explained; they do not establish that the submitter owns the receiving wallet. No reliable person name or handle is attributable from the available records.

The three low-activity voting wallets are 79ed, ac1 and f7. Their nonce and prior-round history are consistent with limited use, but do not prove they were freshly created. b897, 3b, cba and 28e8 have earlier activity and should not be described as fresh wallets. Counts below refer to the saved audit cutoff, not current live activity.

| Wallet and links | Associated submitter / possible controller (unverified) | Entry | Observed activity | Evidence basis | Association confidence | Common-control confidence |
| --- | --- | --- | --- | --- | --- | --- |
| 0x79ed59c8c92ff3f3384c2c43e1088e6b56e8af6e<br>[Yellow profile](https://yellowcollective.art/profile/0x79ed59c8c92ff3f3384c2c43e1088e6b56e8af6e) / [Basescan](https://basescan.org/address/0x79ed59c8c92ff3f3384c2c43e1088e6b56e8af6e) | 0x9ab51fd89f163d07127df192b615356d53b406f6<br>[Yellow profile](https://yellowcollective.art/profile/0x9ab51fd89f163d07127df192b615356d53b406f6) / [Basescan](https://basescan.org/address/0x9ab51fd89f163d07127df192b615356d53b406f6) | Rise of the Heroes | Limited observed activity: nonce 0; no other-round allocations. Creation date unknown. | Rise submitter sent NFT 860 before snapshot; recipient cast 25 Rise votes. (F01) | HIGH: direct transfer and support | LOW TO MODERATE; ownership unproven |
| 0xb89743f3b06d66ed5d7e3bbdf8312f6856de6c6b<br>[Yellow profile](https://yellowcollective.art/profile/0xb89743f3b06d66ed5d7e3bbdf8312f6856de6c6b) / [Basescan](https://basescan.org/address/0xb89743f3b06d66ed5d7e3bbdf8312f6856de6c6b) | 0x9ab51fd89f163d07127df192b615356d53b406f6<br>[Yellow profile](https://yellowcollective.art/profile/0x9ab51fd89f163d07127df192b615356d53b406f6) / [Basescan](https://basescan.org/address/0x9ab51fd89f163d07127df192b615356d53b406f6) | Rise of the Heroes | Established wallet: Base activity in 2024; one other-round allocation; nonce 3. | Rise submitter sent NFT 870 before snapshot; recipient cast 25 Rise votes. (F01) | HIGH: direct transfer and support | LOW TO MODERATE; ownership unproven |
| 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a<br>[Yellow profile](https://yellowcollective.art/profile/0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a) / [Basescan](https://basescan.org/address/0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a) | 0x1bae19af613bd5db94baf043d5817e16a53a4c33<br>[Yellow profile](https://yellowcollective.art/profile/0x1bae19af613bd5db94baf043d5817e16a53a4c33) / [Basescan](https://basescan.org/address/0x1bae19af613bd5db94baf043d5817e16a53a4c33) | Candleman / Chicken | Established activity: nonce 170; one other-round allocation; older funding links. | Repeated NFT 820 circulation with Candleman submitter, mutual funding, and 25 Candleman votes. (F02) | HIGH: repeated direct relationships | MODERATE; ownership unproven |
| 0xcba18cb7e7c043b378e21607fa104f1767442348<br>[Yellow profile](https://yellowcollective.art/profile/0xcba18cb7e7c043b378e21607fa104f1767442348) / [Basescan](https://basescan.org/address/0xcba18cb7e7c043b378e21607fa104f1767442348) | 0x1bae19af613bd5db94baf043d5817e16a53a4c33<br>[Yellow profile](https://yellowcollective.art/profile/0x1bae19af613bd5db94baf043d5817e16a53a4c33) / [Basescan](https://basescan.org/address/0x1bae19af613bd5db94baf043d5817e16a53a4c33) | Candleman / Chicken | Established wallet: nonce 6401; 33 other-round allocations. | Received NFT 254 from Candleman submitter in July; repeated funding with submitter and gas funding to 3b before NFT 820 return; 22 Candleman votes. (F04) | HIGH: transfer and funding relationship | LOW TO MODERATE; ownership unproven |
| 0xac1a6f43425efdd808748a6eb992fa047e90776e<br>[Yellow profile](https://yellowcollective.art/profile/0xac1a6f43425efdd808748a6eb992fa047e90776e) / [Basescan](https://basescan.org/address/0xac1a6f43425efdd808748a6eb992fa047e90776e) | 0xe212d2ca76e29c0d3a8ebfb665abf4679535df27<br>[Yellow profile](https://yellowcollective.art/profile/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) / [Basescan](https://basescan.org/address/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) | Yellow Tattoo | Limited observed activity: nonce 10; no other-round allocations. Creation date unknown. | Delegated eligibility, only 25 Tattoo votes, near-simultaneous ballot with f7; later sent NFT 955 directly to Tattoo submitter. (F03) | HIGH: direct subsequent transfer and support | LOW TO MODERATE; ownership unproven |
| 0xf7aef946d3f2e58a3685166ace1fc3db76d614de<br>[Yellow profile](https://yellowcollective.art/profile/0xf7aef946d3f2e58a3685166ace1fc3db76d614de) / [Basescan](https://basescan.org/address/0xf7aef946d3f2e58a3685166ace1fc3db76d614de) | 0xe212d2ca76e29c0d3a8ebfb665abf4679535df27<br>[Yellow profile](https://yellowcollective.art/profile/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) / [Basescan](https://basescan.org/address/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) | Yellow Tattoo | Limited observed activity: nonce 1; no other-round allocations. Creation date unknown. | Delegated eligibility; only 25 Tattoo votes, 63 seconds after ac1. No direct NFT transfer to/from submitter identified. (F03) | MODERATE: voting/delegation chronology | LOW; circumstantial candidate only |
| 0x2b3b52e0ffaa5f9ab2dae0827929e7688c86aa63<br>[Yellow profile](https://yellowcollective.art/profile/0x2b3b52e0ffaa5f9ab2dae0827929e7688c86aa63) / [Basescan](https://basescan.org/address/0x2b3b52e0ffaa5f9ab2dae0827929e7688c86aa63) | 0xe212d2ca76e29c0d3a8ebfb665abf4679535df27<br>[Yellow profile](https://yellowcollective.art/profile/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) / [Basescan](https://basescan.org/address/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) | Yellow Tattoo delegation cluster | External delegator; complete account history not established. | Owned NFT 944 and delegated it to ac1 before snapshot. Indirect link to submitter through ac1, not a proven owner attribution. (F03) | MODERATE: indirect relationship | LOW; no direct submitter-control evidence |
| 0x33bffd2f818c79b9c6eb38193e32c5b5d17176c6<br>[Yellow profile](https://yellowcollective.art/profile/0x33bffd2f818c79b9c6eb38193e32c5b5d17176c6) / [Basescan](https://basescan.org/address/0x33bffd2f818c79b9c6eb38193e32c5b5d17176c6) | 0xe212d2ca76e29c0d3a8ebfb665abf4679535df27<br>[Yellow profile](https://yellowcollective.art/profile/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) / [Basescan](https://basescan.org/address/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) | Yellow Tattoo delegation cluster | External delegator; complete account history not established. | Owned NFT 945 and delegated it to f7 before snapshot. Indirect link to submitter through the paired voting chronology. (F03) | LOW TO MODERATE: indirect relationship | LOW; no direct submitter-control evidence |
| 0x9234ccdea92b38071458b6837bddbddd874bfc26<br>[Yellow profile](https://yellowcollective.art/profile/0x9234ccdea92b38071458b6837bddbddd874bfc26) / [Basescan](https://basescan.org/address/0x9234ccdea92b38071458b6837bddbddd874bfc26) | 0xe212d2ca76e29c0d3a8ebfb665abf4679535df27<br>[Yellow profile](https://yellowcollective.art/profile/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) / [Basescan](https://basescan.org/address/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) | Yellow Tattoo | External delegator; complete account history not established. | Owned NFT 946 and delegated directly to Tattoo submitter, then revoked shortly after ac1/f7 votes. (F03) | HIGH: direct delegation relationship | LOW; delegation does not establish common control |
| 0x28e8292c6b21288140c5b4f16b28cede42e8098c<br>[Yellow profile](https://yellowcollective.art/profile/0x28e8292c6b21288140c5b4f16b28cede42e8098c) / [Basescan](https://basescan.org/address/0x28e8292c6b21288140c5b4f16b28cede42e8098c) | Unknown; donor link to 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4<br>[Yellow profile](https://yellowcollective.art/profile/0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4) / [Basescan](https://basescan.org/address/0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4) | No submitter attribution established | Established onchain activity: nonce 393, despite no other-round allocations. | Received NFT 355 from 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4; paired full-budget ballots. That donor is another voter, not a Comic Strips submitter. (F05) | HIGH for donor relationship; no submitter attribution | UNKNOWN; possible relationship to donor is not ownership proof |

Resolve ownership by establishing who controlled each signing wallet when votes were cast. A confirmed submitter-controlled voting wallet would strengthen an alternate-wallet self-vote finding; an independent gift recipient or delegate would support retaining the votes. The report's recommendations remain unchanged because no new control evidence has been obtained.

## Wallet profile links

Links cover all 43 round participants and every additional wallet or onchain counterparty named in this report. A profile link does not establish identity or common control.

| Wallet | Role | Yellow Collective profile | Basescan address |
| --- | --- | --- | --- |
| 0x003276c5c24cdaff1d804170ab5cbb914f51f78a | Voter | [Profile](https://yellowcollective.art/profile/0x003276c5c24cdaff1d804170ab5cbb914f51f78a) | [Basescan](https://basescan.org/address/0x003276c5c24cdaff1d804170ab5cbb914f51f78a) |
| 0x0081e6f9373c1ffb7d7fc702eb15ac805eb50389 | Voter | [Profile](https://yellowcollective.art/profile/0x0081e6f9373c1ffb7d7fc702eb15ac805eb50389) | [Basescan](https://basescan.org/address/0x0081e6f9373c1ffb7d7fc702eb15ac805eb50389) |
| 0x00ec9615ab4f45cbeb66b5fa36bced3d79f38bb3 | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0x00ec9615ab4f45cbeb66b5fa36bced3d79f38bb3) | [Basescan](https://basescan.org/address/0x00ec9615ab4f45cbeb66b5fa36bced3d79f38bb3) |
| 0x089490a8b64d36d9764aca7a65bd6e715e254619 | Submitter | [Profile](https://yellowcollective.art/profile/0x089490a8b64d36d9764aca7a65bd6e715e254619) | [Basescan](https://basescan.org/address/0x089490a8b64d36d9764aca7a65bd6e715e254619) |
| 0x0aa23a7e112889c965010558803813710becf263 | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0x0aa23a7e112889c965010558803813710becf263) | [Basescan](https://basescan.org/address/0x0aa23a7e112889c965010558803813710becf263) |
| 0x0b379f1848fa2aab7790966373618f4b0fea6a6e | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0x0b379f1848fa2aab7790966373618f4b0fea6a6e) | [Basescan](https://basescan.org/address/0x0b379f1848fa2aab7790966373618f4b0fea6a6e) |
| 0x1ba77f0359fb0e0c13a93ba284a084da2122e957 | Submitter | [Profile](https://yellowcollective.art/profile/0x1ba77f0359fb0e0c13a93ba284a084da2122e957) | [Basescan](https://basescan.org/address/0x1ba77f0359fb0e0c13a93ba284a084da2122e957) |
| 0x1bae19af613bd5db94baf043d5817e16a53a4c33 | Submitter | [Profile](https://yellowcollective.art/profile/0x1bae19af613bd5db94baf043d5817e16a53a4c33) | [Basescan](https://basescan.org/address/0x1bae19af613bd5db94baf043d5817e16a53a4c33) |
| 0x2262d4288f35b75831f0b132a7b1fcf719430274 | Voter | [Profile](https://yellowcollective.art/profile/0x2262d4288f35b75831f0b132a7b1fcf719430274) | [Basescan](https://basescan.org/address/0x2262d4288f35b75831f0b132a7b1fcf719430274) |
| 0x22d187e0392632386b6dc542d5c494602e0e67fe | Voter | [Profile](https://yellowcollective.art/profile/0x22d187e0392632386b6dc542d5c494602e0e67fe) | [Basescan](https://basescan.org/address/0x22d187e0392632386b6dc542d5c494602e0e67fe) |
| 0x23a355cf3246e44d4c734435d968ac92de85f822 | Submitter | [Profile](https://yellowcollective.art/profile/0x23a355cf3246e44d4c734435d968ac92de85f822) | [Basescan](https://basescan.org/address/0x23a355cf3246e44d4c734435d968ac92de85f822) |
| 0x28e8292c6b21288140c5b4f16b28cede42e8098c | Voter | [Profile](https://yellowcollective.art/profile/0x28e8292c6b21288140c5b4f16b28cede42e8098c) | [Basescan](https://basescan.org/address/0x28e8292c6b21288140c5b4f16b28cede42e8098c) |
| 0x2b3b52e0ffaa5f9ab2dae0827929e7688c86aa63 | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0x2b3b52e0ffaa5f9ab2dae0827929e7688c86aa63) | [Basescan](https://basescan.org/address/0x2b3b52e0ffaa5f9ab2dae0827929e7688c86aa63) |
| 0x33bffd2f818c79b9c6eb38193e32c5b5d17176c6 | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0x33bffd2f818c79b9c6eb38193e32c5b5d17176c6) | [Basescan](https://basescan.org/address/0x33bffd2f818c79b9c6eb38193e32c5b5d17176c6) |
| 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a | Voter | [Profile](https://yellowcollective.art/profile/0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a) | [Basescan](https://basescan.org/address/0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a) |
| 0x46978b8e5f2d1e6e077d35047337b4fcc18d4079 | Submitter | [Profile](https://yellowcollective.art/profile/0x46978b8e5f2d1e6e077d35047337b4fcc18d4079) | [Basescan](https://basescan.org/address/0x46978b8e5f2d1e6e077d35047337b4fcc18d4079) |
| 0x4a90f5a9401158a70f5f307aa13ff0b0e62c7b51 | Voter | [Profile](https://yellowcollective.art/profile/0x4a90f5a9401158a70f5f307aa13ff0b0e62c7b51) | [Basescan](https://basescan.org/address/0x4a90f5a9401158a70f5f307aa13ff0b0e62c7b51) |
| 0x4d1fd46f87449ffe235e3fce21df8a9bf8bd9206 | Voter | [Profile](https://yellowcollective.art/profile/0x4d1fd46f87449ffe235e3fce21df8a9bf8bd9206) | [Basescan](https://basescan.org/address/0x4d1fd46f87449ffe235e3fce21df8a9bf8bd9206) |
| 0x4e0658e1e379faf0b96b78cfe7051f87c07900e2 | Voter / Submitter | [Profile](https://yellowcollective.art/profile/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) | [Basescan](https://basescan.org/address/0x4e0658e1e379faf0b96b78cfe7051f87c07900e2) |
| 0x4e2a3a65d0e2bcdb507a70fe2d3fc5dff464aa25 | Voter | [Profile](https://yellowcollective.art/profile/0x4e2a3a65d0e2bcdb507a70fe2d3fc5dff464aa25) | [Basescan](https://basescan.org/address/0x4e2a3a65d0e2bcdb507a70fe2d3fc5dff464aa25) |
| 0x5bfeb4ca066c9458842ac89b6e5cd983bd1a1034 | Voter | [Profile](https://yellowcollective.art/profile/0x5bfeb4ca066c9458842ac89b6e5cd983bd1a1034) | [Basescan](https://basescan.org/address/0x5bfeb4ca066c9458842ac89b6e5cd983bd1a1034) |
| 0x5eaa352f438023f956f8e6bd581f37a67971e46b | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0x5eaa352f438023f956f8e6bd581f37a67971e46b) | [Basescan](https://basescan.org/address/0x5eaa352f438023f956f8e6bd581f37a67971e46b) |
| 0x629cdc268744a980cd747fab873d9a34cbcddac0 | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0x629cdc268744a980cd747fab873d9a34cbcddac0) | [Basescan](https://basescan.org/address/0x629cdc268744a980cd747fab873d9a34cbcddac0) |
| 0x666d05f03f5ce27a1a90aff6f3d6d05ed75da666 | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0x666d05f03f5ce27a1a90aff6f3d6d05ed75da666) | [Basescan](https://basescan.org/address/0x666d05f03f5ce27a1a90aff6f3d6d05ed75da666) |
| 0x79ed59c8c92ff3f3384c2c43e1088e6b56e8af6e | Voter | [Profile](https://yellowcollective.art/profile/0x79ed59c8c92ff3f3384c2c43e1088e6b56e8af6e) | [Basescan](https://basescan.org/address/0x79ed59c8c92ff3f3384c2c43e1088e6b56e8af6e) |
| 0x7c173d5bfa4efdda7ae0ccd6f4c8062121c9a512 | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0x7c173d5bfa4efdda7ae0ccd6f4c8062121c9a512) | [Basescan](https://basescan.org/address/0x7c173d5bfa4efdda7ae0ccd6f4c8062121c9a512) |
| 0x7dcff286f8e45b9a5c31bb990c0007d4ee5f7ec0 | Submitter | [Profile](https://yellowcollective.art/profile/0x7dcff286f8e45b9a5c31bb990c0007d4ee5f7ec0) | [Basescan](https://basescan.org/address/0x7dcff286f8e45b9a5c31bb990c0007d4ee5f7ec0) |
| 0x8621ffa9fd2b61bfa485798a1082d23dc920e8d1 | Voter | [Profile](https://yellowcollective.art/profile/0x8621ffa9fd2b61bfa485798a1082d23dc920e8d1) | [Basescan](https://basescan.org/address/0x8621ffa9fd2b61bfa485798a1082d23dc920e8d1) |
| 0x8661ee79c9ec060bd263f41420ff1b4a36bb3ce8 | Voter | [Profile](https://yellowcollective.art/profile/0x8661ee79c9ec060bd263f41420ff1b4a36bb3ce8) | [Basescan](https://basescan.org/address/0x8661ee79c9ec060bd263f41420ff1b4a36bb3ce8) |
| 0x9234ccdea92b38071458b6837bddbddd874bfc26 | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0x9234ccdea92b38071458b6837bddbddd874bfc26) | [Basescan](https://basescan.org/address/0x9234ccdea92b38071458b6837bddbddd874bfc26) |
| 0x94b9cf6ee586e656fb76ce62d0e5956f14cfecc5 | Voter | [Profile](https://yellowcollective.art/profile/0x94b9cf6ee586e656fb76ce62d0e5956f14cfecc5) | [Basescan](https://basescan.org/address/0x94b9cf6ee586e656fb76ce62d0e5956f14cfecc5) |
| 0x94bd21234bb1fb52b58263ad76996ba3baea48df | Submitter | [Profile](https://yellowcollective.art/profile/0x94bd21234bb1fb52b58263ad76996ba3baea48df) | [Basescan](https://basescan.org/address/0x94bd21234bb1fb52b58263ad76996ba3baea48df) |
| 0x97c8b754a6956832e56b3958943d0ce47fde4665 | Voter / Submitter | [Profile](https://yellowcollective.art/profile/0x97c8b754a6956832e56b3958943d0ce47fde4665) | [Basescan](https://basescan.org/address/0x97c8b754a6956832e56b3958943d0ce47fde4665) |
| 0x9ab51fd89f163d07127df192b615356d53b406f6 | Voter / Submitter | [Profile](https://yellowcollective.art/profile/0x9ab51fd89f163d07127df192b615356d53b406f6) | [Basescan](https://basescan.org/address/0x9ab51fd89f163d07127df192b615356d53b406f6) |
| 0x9c87a1065994f156f0b7b87aaa8b3c5f7bd67e02 | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0x9c87a1065994f156f0b7b87aaa8b3c5f7bd67e02) | [Basescan](https://basescan.org/address/0x9c87a1065994f156f0b7b87aaa8b3c5f7bd67e02) |
| 0x9ffaab6c24d4fb58d61b26b08c8795e9e323f28b | Voter | [Profile](https://yellowcollective.art/profile/0x9ffaab6c24d4fb58d61b26b08c8795e9e323f28b) | [Basescan](https://basescan.org/address/0x9ffaab6c24d4fb58d61b26b08c8795e9e323f28b) |
| 0xa09aa75da763d4aeb692672897c057786cdd258b | Submitter | [Profile](https://yellowcollective.art/profile/0xa09aa75da763d4aeb692672897c057786cdd258b) | [Basescan](https://basescan.org/address/0xa09aa75da763d4aeb692672897c057786cdd258b) |
| 0xa2746b2a56f9886925c03af1d1e10b8b3dfbbe29 | Voter | [Profile](https://yellowcollective.art/profile/0xa2746b2a56f9886925c03af1d1e10b8b3dfbbe29) | [Basescan](https://basescan.org/address/0xa2746b2a56f9886925c03af1d1e10b8b3dfbbe29) |
| 0xa635a137bbddc01a7a8a09680a91dd72cb71c100 | Voter | [Profile](https://yellowcollective.art/profile/0xa635a137bbddc01a7a8a09680a91dd72cb71c100) | [Basescan](https://basescan.org/address/0xa635a137bbddc01a7a8a09680a91dd72cb71c100) |
| 0xa87daa2bc3bd0ecca4c9111776bab2c9d44d6c6b | Voter | [Profile](https://yellowcollective.art/profile/0xa87daa2bc3bd0ecca4c9111776bab2c9d44d6c6b) | [Basescan](https://basescan.org/address/0xa87daa2bc3bd0ecca4c9111776bab2c9d44d6c6b) |
| 0xa903c06bf35286f6d1cdad25396748353979a44c | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0xa903c06bf35286f6d1cdad25396748353979a44c) | [Basescan](https://basescan.org/address/0xa903c06bf35286f6d1cdad25396748353979a44c) |
| 0xa92317295bc7cb5eceba6956d2bad89a3bc8e1df | Voter | [Profile](https://yellowcollective.art/profile/0xa92317295bc7cb5eceba6956d2bad89a3bc8e1df) | [Basescan](https://basescan.org/address/0xa92317295bc7cb5eceba6956d2bad89a3bc8e1df) |
| 0xac1a6f43425efdd808748a6eb992fa047e90776e | Voter | [Profile](https://yellowcollective.art/profile/0xac1a6f43425efdd808748a6eb992fa047e90776e) | [Basescan](https://basescan.org/address/0xac1a6f43425efdd808748a6eb992fa047e90776e) |
| 0xae4705dc0816ee6d8a13f1c72780ec5021915fed | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0xae4705dc0816ee6d8a13f1c72780ec5021915fed) | [Basescan](https://basescan.org/address/0xae4705dc0816ee6d8a13f1c72780ec5021915fed) |
| 0xb89743f3b06d66ed5d7e3bbdf8312f6856de6c6b | Voter | [Profile](https://yellowcollective.art/profile/0xb89743f3b06d66ed5d7e3bbdf8312f6856de6c6b) | [Basescan](https://basescan.org/address/0xb89743f3b06d66ed5d7e3bbdf8312f6856de6c6b) |
| 0xba8e0841cd9a95c80ccbd502b08f73f8e30f2186 | Voter / Submitter | [Profile](https://yellowcollective.art/profile/0xba8e0841cd9a95c80ccbd502b08f73f8e30f2186) | [Basescan](https://basescan.org/address/0xba8e0841cd9a95c80ccbd502b08f73f8e30f2186) |
| 0xbe14b9950dc61642a084eab491fa516d8fe557e6 | Voter | [Profile](https://yellowcollective.art/profile/0xbe14b9950dc61642a084eab491fa516d8fe557e6) | [Basescan](https://basescan.org/address/0xbe14b9950dc61642a084eab491fa516d8fe557e6) |
| 0xc578958dd1880cf00bffbb7feb9c28cbbbcad3bf | Voter | [Profile](https://yellowcollective.art/profile/0xc578958dd1880cf00bffbb7feb9c28cbbbcad3bf) | [Basescan](https://basescan.org/address/0xc578958dd1880cf00bffbb7feb9c28cbbbcad3bf) |
| 0xca89e2472fe57bdc74f2361ceea5962fb205119c | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0xca89e2472fe57bdc74f2361ceea5962fb205119c) | [Basescan](https://basescan.org/address/0xca89e2472fe57bdc74f2361ceea5962fb205119c) |
| 0xcb6eb98d0533dd42367cd064fc5b988814187527 | Submitter | [Profile](https://yellowcollective.art/profile/0xcb6eb98d0533dd42367cd064fc5b988814187527) | [Basescan](https://basescan.org/address/0xcb6eb98d0533dd42367cd064fc5b988814187527) |
| 0xcba18cb7e7c043b378e21607fa104f1767442348 | Voter | [Profile](https://yellowcollective.art/profile/0xcba18cb7e7c043b378e21607fa104f1767442348) | [Basescan](https://basescan.org/address/0xcba18cb7e7c043b378e21607fa104f1767442348) |
| 0xd091d0a86ff1ee9d9e24e9d6e6990592d7cb3998 | Submitter | [Profile](https://yellowcollective.art/profile/0xd091d0a86ff1ee9d9e24e9d6e6990592d7cb3998) | [Basescan](https://basescan.org/address/0xd091d0a86ff1ee9d9e24e9d6e6990592d7cb3998) |
| 0xd4eaa5e657c8b3349cb6becf8ac097839e9e7af5 | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0xd4eaa5e657c8b3349cb6becf8ac097839e9e7af5) | [Basescan](https://basescan.org/address/0xd4eaa5e657c8b3349cb6becf8ac097839e9e7af5) |
| 0xdcf37d8aa17142f053aaa7dc56025ab00d897a19 | Voter | [Profile](https://yellowcollective.art/profile/0xdcf37d8aa17142f053aaa7dc56025ab00d897a19) | [Basescan](https://basescan.org/address/0xdcf37d8aa17142f053aaa7dc56025ab00d897a19) |
| 0xe212d2ca76e29c0d3a8ebfb665abf4679535df27 | Submitter | [Profile](https://yellowcollective.art/profile/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) | [Basescan](https://basescan.org/address/0xe212d2ca76e29c0d3a8ebfb665abf4679535df27) |
| 0xe348b541dd51c5e7b32557f055f7205e6d8c0a6d | Other onchain counterparty | [Profile](https://yellowcollective.art/profile/0xe348b541dd51c5e7b32557f055f7205e6d8c0a6d) | [Basescan](https://basescan.org/address/0xe348b541dd51c5e7b32557f055f7205e6d8c0a6d) |
| 0xed764f46c8b6e4ebeadb795017e436ddb3561476 | Voter / Submitter | [Profile](https://yellowcollective.art/profile/0xed764f46c8b6e4ebeadb795017e436ddb3561476) | [Basescan](https://basescan.org/address/0xed764f46c8b6e4ebeadb795017e436ddb3561476) |
| 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4 | Voter | [Profile](https://yellowcollective.art/profile/0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4) | [Basescan](https://basescan.org/address/0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4) |
| 0xf7aef946d3f2e58a3685166ace1fc3db76d614de | Voter | [Profile](https://yellowcollective.art/profile/0xf7aef946d3f2e58a3685166ace1fc3db76d614de) | [Basescan](https://basescan.org/address/0xf7aef946d3f2e58a3685166ace1fc3db76d614de) |

## Allocations requiring review

| Priority | Finding | Vote ID | Entry | Voter | Count | Created / updated UTC |
| --- | --- | --- | --- | --- | --- | --- |
| HIGH | F01 | 131985c6-7075-4b79-99b4-1072d76c4443 | YELLOW COLLECTIVE: Rise of the Heroes | 0x79ed59c8c92ff3f3384c2c43e1088e6b56e8af6e | 25 | 2026-09-25T00:00:52.364Z / 2026-09-25T00:00:52.364Z |
| HIGH | F02 | ab8b1cec-b3cd-49ab-a86c-70dd3a76aeea | Candleman: The Roosters Invasion | 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a | 25 | 2026-09-25T00:49:57.503Z / 2026-09-25T00:49:57.503Z |
| HIGH | F01 | dc72da0e-174b-4ebe-8e30-b0dae81c1f64 | YELLOW COLLECTIVE: Rise of the Heroes | 0xb89743f3b06d66ed5d7e3bbdf8312f6856de6c6b | 25 | 2026-09-26T01:47:37.885Z / 2026-09-26T01:47:37.885Z |
| MEDIUM | F04 | 585acf98-9863-4a88-b47d-b48f43d9f828 | Candleman: The Roosters Invasion | 0xcba18cb7e7c043b378e21607fa104f1767442348 | 22 | 2026-09-26T18:27:52.166Z / 2026-10-01T17:56:07.279Z |
| HIGH | F03 | 8e2cdd0d-5145-4d25-9e75-ab2ebc8aeca7 | Yellow Tattoo | 0xac1a6f43425efdd808748a6eb992fa047e90776e | 25 | 2026-09-28T03:31:58.552Z / 2026-09-28T03:31:58.552Z |
| HIGH | F03 | d67a0e5a-526b-4730-b18a-b005ccbae1c9 | Yellow Tattoo | 0xf7aef946d3f2e58a3685166ace1fc3db76d614de | 25 | 2026-09-28T03:33:01.740Z / 2026-09-28T03:33:01.740Z |
| LOW | F05 | 053a2276-9b5d-404b-98e3-1c424f0eb7ae | Fire Safety 101: Oops | 0x28e8292c6b21288140c5b4f16b28cede42e8098c | 1 | 2026-10-01T19:43:28.601Z / 2026-10-01T19:43:28.601Z |
| LOW | F05 | 1d4896b8-ee10-4c27-a31f-82ae8cab4da8 | Oh Yeah-Low Minded | 0x28e8292c6b21288140c5b4f16b28cede42e8098c | 25 | 2026-10-01T19:43:28.601Z / 2026-10-01T19:43:28.601Z |
| LOW | F05 | 2fdd6a33-d368-4416-b0d6-0f0041ec5a52 | YELLOW COLLECTIVE: Rise of the Heroes | 0x28e8292c6b21288140c5b4f16b28cede42e8098c | 25 | 2026-10-01T19:43:28.601Z / 2026-10-01T19:43:28.601Z |
| LOW | F05 | 3452a946-ffb6-44cc-8ec9-8f35bfa32bdf | Yellow Collective Conference | 0x28e8292c6b21288140c5b4f16b28cede42e8098c | 25 | 2026-10-01T19:43:28.601Z / 2026-10-01T19:43:28.601Z |
| LOW | F05 | f3fa7f44-3b85-4ba4-a9b3-29364e94c4e3 | Are you winning, Son? (Yellow Collective Edition) | 0x28e8292c6b21288140c5b4f16b28cede42e8098c | 25 | 2026-10-01T19:43:28.601Z / 2026-10-01T19:43:28.601Z |
| LOW | F05 | 27975fc5-fe44-4feb-bf59-d85c972fb052 | YELLOW COLLECTIVE: Rise of the Heroes | 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4 | 1 | 2026-10-01T19:44:24.430Z / 2026-10-01T19:44:24.430Z |
| LOW | F05 | 40a891dc-ae8f-4b7c-8692-46b02ea0619f | Fire Safety 101: Oops | 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4 | 25 | 2026-10-01T19:44:24.430Z / 2026-10-01T19:44:24.430Z |
| LOW | F05 | 7dae4f1b-8aa9-466d-9b43-107e235670f3 | Are you winning, Son? (Yellow Collective Edition) | 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4 | 25 | 2026-10-01T19:44:24.430Z / 2026-10-01T19:44:24.430Z |
| LOW | F05 | bbb0edc6-5b68-4d14-831d-4d68fb5f8acd | Yellow Collective Conference | 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4 | 25 | 2026-10-01T19:44:24.430Z / 2026-10-01T19:44:24.430Z |
| LOW | F05 | d7a5c913-d985-4d47-8363-b3d5cb6e6c7b | Nounish Cookies! | 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4 | 25 | 2026-10-01T19:44:24.430Z / 2026-10-01T19:44:24.430Z |

## F01: Rise submitter supplied two eligible voters

**Decision: REVIEW BEFORE AWARDING (HIGH); 50 votes.**

The submitting wallet initiated both transfers before the snapshot. Each recipient gained getVotes 0 to 1 and then allocated 25 to Rise. NFTs remained with recipients through cutoff.

- Facts confidence: HIGH for verified receipts, transfers and snapshot calls.
- Control/coordination inference: LOW TO MODERATE: direct transfers and supportive ballots are proven; common control is not.
- Rule violation: UNPROVEN. Self-vote wording may apply if beneficial control is established. No identified transfer/loan/multiwallet disqualification rule.
- Deliberate intent: UNPROVEN.
- Credible alternatives: Independent gifts or sales and legitimate support. b897 had Base activity in 2024 and one other-round allocation. 79ed nonce zero is not evidence of creation date.
- Smallest resolving question: Who controlled each recipient when signing the Comic Strips vote, and were the transfers gifts, purchases, or custody arrangements?

| Wallet | Snapshot getVotes / balance | Capacity / used | Base nonce | Other-round allocations |
| --- | --- | --- | --- | --- |
| 0x9ab51fd89f163d07127df192b615356d53b406f6 | 2 / 2 | 102 / 80 | 284 | 11 |
| 0x79ed59c8c92ff3f3384c2c43e1088e6b56e8af6e | 1 / 1 | 101 / 50 | 0 | 0 |
| 0xb89743f3b06d66ed5d7e3bbdf8312f6856de6c6b | 1 / 1 | 101 / 71 | 3 | 1 |

### Chronology and primary evidence

| UTC | Event/token | Sender → recipient | Block / log | Signer; method | Receipt | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-04-04T15:00:13.000000Z | Transfer #860 | 0x0000000000000000000000000000000000000000 → 0x0b379f1848fa2aab7790966373618f4b0fea6a6e | 44262733 / 440 | 0x666d05f03f5ce27a1a90aff6f3d6d05ed75da666; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0xaa01c6892ba8ac2ba4a45649e9d2f627021a5d7c2538733f0f13db70c90a3f0c) |
| 2026-07-29T22:30:03.000000Z | Transfer #860 | 0x0b379f1848fa2aab7790966373618f4b0fea6a6e → 0x00ec9615ab4f45cbeb66b5fa36bced3d79f38bb3 | 49287428 / 52 | 0x0b379f1848fa2aab7790966373618f4b0fea6a6e; 0x32389b71 | verified | [transaction](https://base.blockscout.com/tx/0x8d1e2b5aba7890b95cdd98f129d09fbb626d565663f1669c006a234b8663b00d) |
| 2026-09-24T00:05:23.000000Z | Transfer #860 | 0x00ec9615ab4f45cbeb66b5fa36bced3d79f38bb3 → 0x9ab51fd89f163d07127df192b615356d53b406f6 | 51709488 / 523 | 0xae4705dc0816ee6d8a13f1c72780ec5021915fed; 0x6a761202 | verified | [transaction](https://base.blockscout.com/tx/0xe07bcb8e8e714ae3093f66ca9f24fc215103bcbbd26f90422c17a8298c5ddd83) |
| 2026-09-24T15:00:39.000000Z | Transfer #860 | 0x9ab51fd89f163d07127df192b615356d53b406f6 → 0x79ed59c8c92ff3f3384c2c43e1088e6b56e8af6e | 51736346 / 564 | 0x9ab51fd89f163d07127df192b615356d53b406f6; 0x23b872dd | verified | [transaction](https://base.blockscout.com/tx/0xe8d03281c3f5c5cff59d7870d941dbe43c3a0b6756653e25bfe09ca05906a817) |
| 2026-04-17T13:21:01.000000Z | Transfer #870 | 0x0000000000000000000000000000000000000000 → 0x0b379f1848fa2aab7790966373618f4b0fea6a6e | 44821357 / 596 | 0xdcf37d8aa17142f053aaa7dc56025ab00d897a19; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0xfa40363226a588c7d693d97413dcd61dfb55204c3870e04ec9fc7e1f241eda1d) |
| 2026-07-29T22:30:03.000000Z | Transfer #870 | 0x0b379f1848fa2aab7790966373618f4b0fea6a6e → 0x00ec9615ab4f45cbeb66b5fa36bced3d79f38bb3 | 49287428 / 49 | 0x0b379f1848fa2aab7790966373618f4b0fea6a6e; 0x32389b71 | verified | [transaction](https://base.blockscout.com/tx/0x8d1e2b5aba7890b95cdd98f129d09fbb626d565663f1669c006a234b8663b00d) |
| 2026-09-15T17:41:03.000000Z | Transfer #870 | 0x00ec9615ab4f45cbeb66b5fa36bced3d79f38bb3 → 0x9ab51fd89f163d07127df192b615356d53b406f6 | 51352358 / 410 | 0xae4705dc0816ee6d8a13f1c72780ec5021915fed; 0x6a761202 | verified | [transaction](https://base.blockscout.com/tx/0xea18d300bc109421eb3c4b68d7c0f51e748b51c07e3eb5dadf2c46b364f7de39) |
| 2026-09-22T07:50:11.000000Z | Transfer #870 | 0x9ab51fd89f163d07127df192b615356d53b406f6 → 0xb89743f3b06d66ed5d7e3bbdf8312f6856de6c6b | 51637032 / 253 | 0x9ab51fd89f163d07127df192b615356d53b406f6; 0x23b872dd | verified | [transaction](https://base.blockscout.com/tx/0xbb6e12f73cc88206bb3d1a1595ee26e80df0eb3efe6da35bebb6057cf2838027) |

## F02: Candleman NFT 820 circulation around snapshot

**Decision: REVIEW BEFORE AWARDING (HIGH); 25 votes.**

Five legs during Sep 24-29: out, back, out before snapshot, back Sep 28 after voting, and out AGAIN Sep 29. Recipient allocated 25 to Candleman. The submitter had zero snapshot power and cast no votes.

- Facts confidence: HIGH for verified receipts, transfers and snapshot calls.
- Control/coordination inference: MODERATE: repeated circulation and pre-existing bidirectional ETH transfers support a relationship, but do not establish common control or a sham loan.
- Rule violation: UNPROVEN. Self-vote wording may apply if beneficial control is established. No identified transfer/loan/multiwallet disqualification rule.
- Deliberate intent: UNPROVEN.
- Credible alternatives: Independent friends, custody, or a real loan. A loan itself was not prohibited by an identified rule.
- Smallest resolving question: Were 1bae and 3b independently controlled at vote signing, and why was 820 circulated repeatedly? If one controller, was voting on that controller's own entry intended?

| Wallet | Snapshot getVotes / balance | Capacity / used | Base nonce | Other-round allocations |
| --- | --- | --- | --- | --- |
| 0x1bae19af613bd5db94baf043d5817e16a53a4c33 | 0 / 0 | 0 / 0 | 2181 | 0 |
| 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a | 1 / 1 | 101 / 101 | 170 | 1 |

### Chronology and primary evidence

| UTC | Event/token | Sender → recipient | Block / log | Signer; method | Receipt | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-01-01T16:02:43.000000Z | Transfer #820 | 0x0000000000000000000000000000000000000000 → 0x0b379f1848fa2aab7790966373618f4b0fea6a6e | 40247008 / 1013 | 0x5bfeb4ca066c9458842ac89b6e5cd983bd1a1034; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0x2adc9aabf3b90ff2fe8f8a6a9f4f4da8d18913741364262ea99cca98cefde134) |
| 2026-07-29T22:30:03.000000Z | Transfer #820 | 0x0b379f1848fa2aab7790966373618f4b0fea6a6e → 0x00ec9615ab4f45cbeb66b5fa36bced3d79f38bb3 | 49287428 / 64 | 0x0b379f1848fa2aab7790966373618f4b0fea6a6e; 0x32389b71 | verified | [transaction](https://base.blockscout.com/tx/0x8d1e2b5aba7890b95cdd98f129d09fbb626d565663f1669c006a234b8663b00d) |
| 2026-09-24T00:05:49.000000Z | Transfer #820 | 0x00ec9615ab4f45cbeb66b5fa36bced3d79f38bb3 → 0x1bae19af613bd5db94baf043d5817e16a53a4c33 | 51709501 / 134 | 0xae4705dc0816ee6d8a13f1c72780ec5021915fed; 0x6a761202 | verified | [transaction](https://base.blockscout.com/tx/0x43809f2f1bc34b4700d2f1efc840a24d3161d209097addd37c2a97a04df8baf8) |
| 2026-09-24T14:26:31.000000Z | Transfer #820 | 0x1bae19af613bd5db94baf043d5817e16a53a4c33 → 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a | 51735322 / 1178 | 0x1bae19af613bd5db94baf043d5817e16a53a4c33; 0x42842e0e | verified | [transaction](https://base.blockscout.com/tx/0x90545b75f9b9037d1837b1d0a32a626a941c94c5512bd51b7fe712308d23f24b) |
| 2026-09-24T14:34:57.000000Z | Transfer #820 | 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a → 0x1bae19af613bd5db94baf043d5817e16a53a4c33 | 51735575 / 333 | 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a; 0x42842e0e | verified | [transaction](https://base.blockscout.com/tx/0x50420acd1abd357a8f882e3fbd5b00aab22cae1bb2ef2811a9d75695e4926c2d) |
| 2026-09-24T16:51:29.000000Z | Transfer #820 | 0x1bae19af613bd5db94baf043d5817e16a53a4c33 → 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a | 51739671 / 393 | 0x1bae19af613bd5db94baf043d5817e16a53a4c33; 0x42842e0e | verified | [transaction](https://base.blockscout.com/tx/0x79c4002f88b163335b08746566a19fa329e697d74cfa5b1926cad14677fbf224) |
| 2026-09-28T04:16:45.000000Z | Transfer #820 | 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a → 0x1bae19af613bd5db94baf043d5817e16a53a4c33 | 51889829 / 11 | 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a; 0x42842e0e | verified | [transaction](https://base.blockscout.com/tx/0x4fdd3eedf0146f16dba76365855ef00f5251188486c51563b6361acad72a333a) |
| 2026-09-29T18:44:35.000000Z | Transfer #820 | 0x1bae19af613bd5db94baf043d5817e16a53a4c33 → 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a | 51959064 / 397 | 0x1bae19af613bd5db94baf043d5817e16a53a4c33; 0x42842e0e | verified | [transaction](https://base.blockscout.com/tx/0xfd96a0493d8ad8f3cc4be6686b0ca7a73618217f47dc4916053ba5793e4197a4) |

## F03: Yellow Tattoo: delegated-only voters and later NFT transfer

**Decision: REVIEW BEFORE AWARDING (HIGH); 50 votes.**

Donors delegated NFTs 944/945 to ac1/f7 about 4h45m before snapshot; donor 946 delegated to Tattoo submitter. ac1/f7 had zero NFT balance but getVotes=1 at snapshot. Each cast only 25 Tattoo votes 63.188 seconds apart. The submitter's delegation was revoked 101.26 seconds after the second ballot. ac1 later sent NFT 955 to the submitter; f7 acquired NFT 959 later.

- Facts confidence: HIGH for verified receipts, transfers and snapshot calls.
- Control/coordination inference: MODERATE for coordination; LOW TO MODERATE for shared control. ac1-to-submitter transfer is direct; f7 connection to submitter is circumstantial.
- Rule violation: UNPROVEN. Self-vote wording may apply if beneficial control is established. No identified transfer/loan/multiwallet disqualification rule.
- Deliberate intent: UNPROVEN.
- Credible alternatives: Independent delegated voters, coordinated legitimate support, or gifts. Donors lost their own power; redelegation does not itself increase global eligible wallet count. Later NFT ownership is irrelevant to snapshot eligibility.
- Smallest resolving question: Who controlled ac1/f7 and the three delegators at snapshot and signing? Was ac1's subsequent NFT 955 transfer a gift/sale or movement between the submitter's own wallets?

| Wallet | Snapshot getVotes / balance | Capacity / used | Base nonce | Other-round allocations |
| --- | --- | --- | --- | --- |
| 0xe212d2ca76e29c0d3a8ebfb665abf4679535df27 | 1 / 0 | 101 / 0 | 0 | 5 |
| 0xac1a6f43425efdd808748a6eb992fa047e90776e | 1 / 0 | 101 / 25 | 10 | 0 |
| 0xf7aef946d3f2e58a3685166ace1fc3db76d614de | 1 / 0 | 101 / 25 | 1 | 0 |

### Chronology and primary evidence

| UTC | Event/token | Sender → recipient | Block / log | Signer; method | Receipt | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-26T18:12:09.000000Z | Transfer #955 | 0x0aa23a7e112889c965010558803813710becf263 → 0xac1a6f43425efdd808748a6eb992fa047e90776e | 51828491 / 129 | 0xac1a6f43425efdd808748a6eb992fa047e90776e; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0x5c9e29ea251e6d2104e601894dc95570a95bbd9e6d2c504ac2785bc232d41655) |
| 2026-09-30T12:24:25.000000Z | Transfer #955 | 0xac1a6f43425efdd808748a6eb992fa047e90776e → 0xe212d2ca76e29c0d3a8ebfb665abf4679535df27 | 51990859 / 953 | 0xac1a6f43425efdd808748a6eb992fa047e90776e; 0xb88d4fde | verified | [transaction](https://base.blockscout.com/tx/0xa4e484ae7fcf832bb214489ee8f858d3fcde3449ebe360c10f67be406e24ff8a) |
| 2026-09-30T05:23:01.000000Z | Transfer #959 | 0x0000000000000000000000000000000000000000 → 0x0aa23a7e112889c965010558803813710becf263 | 51978217 / 797 | 0x629cdc268744a980cd747fab873d9a34cbcddac0; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0x6ac2f9870a7a677592b749d70399be43615ce1cc8221a934c60557af6b6e8eeb) |
| 2026-10-01T13:31:19.000000Z | Transfer #959 | 0x0aa23a7e112889c965010558803813710becf263 → 0xf7aef946d3f2e58a3685166ace1fc3db76d614de | 52036066 / 603 | 0xe348b541dd51c5e7b32557f055f7205e6d8c0a6d; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0x41f09e137b88af76a96ad85cc768add369c0bb11fcb11982b887d6b876668244) |
| 2026-08-21T17:51:13.000000Z | Transfer #944 | 0x0000000000000000000000000000000000000000 → 0x0aa23a7e112889c965010558803813710becf263 | 50272663 / 846 | ;  | indexer only | [transaction](https://base.blockscout.com/tx/0x03e2daf356281a77feff5312e09f838254363add50697f1ae48f1b65509fdf6a) |
| 2026-08-22T22:33:11.000000Z | Transfer #944 | 0x0aa23a7e112889c965010558803813710becf263 → 0x2b3b52e0ffaa5f9ab2dae0827929e7688c86aa63 | 50324322 / 101 | 0x5bfeb4ca066c9458842ac89b6e5cd983bd1a1034; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0x50e49ffb1fa014afe2ffbaf33bb4ca73b3c33fd04cc0f7e9328d45d2744bd645) |
| 2026-08-22T22:33:11.000000Z | Transfer #945 | 0x0000000000000000000000000000000000000000 → 0x0aa23a7e112889c965010558803813710becf263 | 50324322 / 105 | 0x5bfeb4ca066c9458842ac89b6e5cd983bd1a1034; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0x50e49ffb1fa014afe2ffbaf33bb4ca73b3c33fd04cc0f7e9328d45d2744bd645) |
| 2026-08-25T19:46:41.000000Z | Transfer #945 | 0x0aa23a7e112889c965010558803813710becf263 → 0x33bffd2f818c79b9c6eb38193e32c5b5d17176c6 | 50448927 / 1289 | 0x7c173d5bfa4efdda7ae0ccd6f4c8062121c9a512; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0x158154e9be41cd20fc7e855eb4a92089f41663450882c18fa869f2776dc2ea30) |
| 2026-08-25T19:46:41.000000Z | Transfer #946 | 0x0000000000000000000000000000000000000000 → 0x0aa23a7e112889c965010558803813710becf263 | 50448927 / 1293 | 0x7c173d5bfa4efdda7ae0ccd6f4c8062121c9a512; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0x158154e9be41cd20fc7e855eb4a92089f41663450882c18fa869f2776dc2ea30) |
| 2026-08-26T23:05:29.000000Z | Transfer #946 | 0x0aa23a7e112889c965010558803813710becf263 → 0x9234ccdea92b38071458b6837bddbddd874bfc26 | 50498091 / 362 | 0x9234ccdea92b38071458b6837bddbddd874bfc26; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0xff2ec9209dc5c925fc8169c25e31db2cf39a68b0ba7d86d0439d71c87a9f6597) |
| 2026-09-24T13:21:31.000Z | DelegateChanged | 0x5eaa352f438023f956f8e6bd581f37a67971e46b → 0x33bffd2f818c79b9c6eb38193e32c5b5d17176c6 | 51733372 / 360 | ;  | indexer only | [transaction](https://base.blockscout.com/tx/0x546fa830c9ea3beac4b5e992651f134502665e3c4d1f2aa8249c2dff7d701fb5) |
| 2026-09-24T13:34:05.000Z | DelegateChanged | 0x2b3b52e0ffaa5f9ab2dae0827929e7688c86aa63 → 0xac1a6f43425efdd808748a6eb992fa047e90776e | 51733749 / 18 | 0x2b3b52e0ffaa5f9ab2dae0827929e7688c86aa63; 0x5c19a95c | verified | [transaction](https://base.blockscout.com/tx/0x379bb34f87eef5d089b67d04943e33cfa99b28190b8b85b499c7950768fab00c) |
| 2026-09-24T13:35:19.000Z | DelegateChanged | 0x33bffd2f818c79b9c6eb38193e32c5b5d17176c6 → 0xf7aef946d3f2e58a3685166ace1fc3db76d614de | 51733786 / 1053 | 0x33bffd2f818c79b9c6eb38193e32c5b5d17176c6; 0x5c19a95c | verified | [transaction](https://base.blockscout.com/tx/0x6e792833e8aa18195c22523b782038b8577de0e3ab57ea70eca12315839729d3) |
| 2026-09-24T13:48:05.000Z | DelegateChanged | 0x9234ccdea92b38071458b6837bddbddd874bfc26 → 0xe212d2ca76e29c0d3a8ebfb665abf4679535df27 | 51734169 / 449 | 0x9234ccdea92b38071458b6837bddbddd874bfc26; 0x5c19a95c | verified | [transaction](https://base.blockscout.com/tx/0x5c2008b50f79479f96a3fe2c293a37475a6fc58e1c05f1a4c61a2c3a6f9191de) |
| 2026-09-28T03:34:43.000Z | DelegateChanged | 0xe212d2ca76e29c0d3a8ebfb665abf4679535df27 → 0x9234ccdea92b38071458b6837bddbddd874bfc26 | 51888568 / 466 | 0x9234ccdea92b38071458b6837bddbddd874bfc26; 0x5c19a95c | verified | [transaction](https://base.blockscout.com/tx/0x996f9ce9ebab02e78c08d90b85937bca21096aa108e5eddce66059031954d810) |

## F04: Candleman older recipient plus repeated funding

**Decision: REVIEW BEFORE AWARDING (MEDIUM); 22 votes.**

NFT 254 moved from Candleman submitter to cba in July. cba cast 22 Candleman votes. Repeated older bidirectional funding exists; cba funded 3b 28 seconds before 820 returned on Sep 24. This strengthens the relationship beyond an isolated old gift.

- Facts confidence: HIGH for verified receipts, transfers and snapshot calls.
- Control/coordination inference: LOW TO MODERATE: established financial relationship, not an attribution of control.
- Rule violation: UNPROVEN. Self-vote wording may apply if beneficial control is established. No identified transfer/loan/multiwallet disqualification rule.
- Deliberate intent: UNPROVEN.
- Credible alternatives: Longstanding independent participants and gas gifts. cba has 6401 nonce and 33 other-round allocations; an old transfer alone is insufficient.
- Smallest resolving question: Is cba an independent person or another wallet controlled by the submitter? What explains funding the 820 return?

| Wallet | Snapshot getVotes / balance | Capacity / used | Base nonce | Other-round allocations |
| --- | --- | --- | --- | --- |
| 0x1bae19af613bd5db94baf043d5817e16a53a4c33 | 0 / 0 | 0 / 0 | 2181 | 0 |
| 0xcba18cb7e7c043b378e21607fa104f1767442348 | 1 / 1 | 101 / 101 | 6401 | 33 |
| 0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a | 1 / 1 | 101 / 101 | 170 | 1 |

### Chronology and primary evidence

| UTC | Event/token | Sender → recipient | Block / log | Signer; method | Receipt | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 2024-07-30T11:59:07.000000Z | Transfer #254 | 0x0000000000000000000000000000000000000000 → 0x0aa23a7e112889c965010558803813710becf263 | 17775700 / 192 | 0xa903c06bf35286f6d1cdad25396748353979a44c; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0x846dbd1ced86795876cd092abf792b0c8913e7ed575c6f5de4e1e84cfe5732ce) |
| 2024-07-31T12:14:59.000000Z | Transfer #254 | 0x0aa23a7e112889c965010558803813710becf263 → 0x1bae19af613bd5db94baf043d5817e16a53a4c33 | 17819376 / 124 | 0xca89e2472fe57bdc74f2361ceea5962fb205119c; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0xf3c682ab09e445c6ad6be599ec00abd75de3d3a00f4e268ac88e876a0fe24385) |
| 2026-07-19T12:54:25.000000Z | Transfer #254 | 0x1bae19af613bd5db94baf043d5817e16a53a4c33 → 0xcba18cb7e7c043b378e21607fa104f1767442348 | 48838159 / 261 | 0x1bae19af613bd5db94baf043d5817e16a53a4c33; 0x42842e0e | verified | [transaction](https://base.blockscout.com/tx/0xefee5828c8afc8433b6aadc83cac90b8fc114d079f876f6f68aaf9461c5e3345) |

## F05: NFT 355 transfer and paired full-budget ballots

**Decision: REVIEW BEFORE AWARDING (LOW); 202 votes.**

f1f5 transferred NFT 355 to 28e8 Sep 22 while retaining NFT 952. Both had getVotes=1 and spent all 101 votes. Ballot batches on Oct 1 were 55.829 seconds apart. Both supported Conference and Son, with different other allocations.

- Facts confidence: HIGH for verified receipts, transfers and snapshot calls.
- Control/coordination inference: LOW: coordination plausible, common control or link to benefiting submitters not established.
- Rule violation: UNPROVEN. Self-vote wording may apply if beneficial control is established. No identified transfer/loan/multiwallet disqualification rule.
- Deliberate intent: UNPROVEN.
- Credible alternatives: Independent gift recipients discussing their choices. Both are established onchain wallets; one had prior round participation.
- Smallest resolving question: Were the two voters independently controlled? No entry-disqualification basis exists without a further link to its submitter.

| Wallet | Snapshot getVotes / balance | Capacity / used | Base nonce | Other-round allocations |
| --- | --- | --- | --- | --- |
| 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4 | 1 / 1 | 101 / 101 | 8436 | 10 |
| 0x28e8292c6b21288140c5b4f16b28cede42e8098c | 1 / 1 | 101 / 101 | 393 | 0 |

### Chronology and primary evidence

| UTC | Event/token | Sender → recipient | Block / log | Signer; method | Receipt | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 2024-10-19T22:44:01.000000Z | Transfer #355 | 0x0000000000000000000000000000000000000000 → 0x0aa23a7e112889c965010558803813710becf263 | 21294247 / 447 | 0xd4eaa5e657c8b3349cb6becf8ac097839e9e7af5; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0xc682af2dcf0c591a7a0a18859183a3a3b8df207f566c8608ebf34a65665dfb54) |
| 2024-10-20T23:09:59.000000Z | Transfer #355 | 0x0aa23a7e112889c965010558803813710becf263 → 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4 | 21338226 / 258 | 0x9c87a1065994f156f0b7b87aaa8b3c5f7bd67e02; 0xf25efffc | verified | [transaction](https://base.blockscout.com/tx/0xce148568a14df182b68a5537c933d776f9a27cec37d308bda3ee311f0083dda9) |
| 2026-09-22T19:12:41.000000Z | Transfer #355 | 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4 → 0x28e8292c6b21288140c5b4f16b28cede42e8098c | 51657507 / 493 | 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4; 0xb88d4fde | verified | [transaction](https://base.blockscout.com/tx/0x089fb1030fffe31d9290f86f48170099381613e2fc96ab916da5e512135a4c1d) |
| 2026-09-20T05:19:23.000000Z | Transfer #952 | 0x0000000000000000000000000000000000000000 → 0x0aa23a7e112889c965010558803813710becf263 | 51546108 / 102 | ;  | indexer only | [transaction](https://base.blockscout.com/tx/0x9f3290e42482a5fa3b14cdc488103e1896b0ca6d045d15ed6974926cf9111d52) |
| 2026-09-21T21:48:19.000000Z | Transfer #952 | 0x0aa23a7e112889c965010558803813710becf263 → 0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4 | 51618976 / 582 | ;  | indexer only | [transaction](https://base.blockscout.com/tx/0x5ef4cb64fd2c4c65d2643d9e72388ccd04066b9f30a60adfbe68d5314e895192) |

## Funding, attribution and wider coverage

Participant-funding-links.json records bounded explorer findings; three September cba funding transactions are receipt-verified in repaired-receipts.json. cba funded 3b on Sep24 14:34:29, immediately before 820's 14:34:57 return. Older mutual transfers among cba/1bae/3b establish an ongoing relationship but do not establish control. No corresponding direct native funding links were observed for Rise/Tattoo in these bounded transaction pages; internal transfers, other chains and intermediaries were not excluded.

No reliable person attribution exists for these clusters. cba's stored profile fields are blank; no implicated profile can identify a culprit. General activity predates the contest for several recipients. NFTs860/870 trace through a shared Safe distribution that also serves other participants; this is not a common-control inference. Auction delivery and shared collection sources likewise are not misconduct. The eleven direct participant-to-participant transfer events and all recipient/source ownership paths were examined. All other allocations are RETAIN absent new evidence, rather than certified independent control.

## Conditional capacity arithmetic

- Rise 9ab+79ed+b897: snapshot delegated power 2+1+1; capacities102+101+101=304; actual80+50+71=201. If one controller consolidated the same four units of power in one wallet, capacity 104: **conditional additional available capacity 200; actual above that hypothetical budget97**. This is not proof the same person cast them. Only50 votes directly supported Rise.
- Candle 1bae+3b: power 0+1; total capacity 101 and used 101, compared with consolidated 101: **zero extra aggregate capacity**. The concern is possible alternate-wallet self-voting, not extra budget between those two. Including cba adds another power 1 and101capacity: combined 202 versus consolidated 102, conditional100 extra capacity and100 above-budget votes used. cba's independent control remains plausible. Direct support 25+22=47.
- Tattoo e212+ac1+f7: three delegated units, capacities101 each=303; actual0+25+25=50. If all three were one controller and power consolidated, capacity 103: conditional200 extra available capacity, **zero actual votes exceeding103**. Only50 direct support votes at issue. Donor delegation shifted power away from donors, so it is not itself net global eligibility creation.
- NFT 355pair: power 1+1; capacities202 and actual202; conditional consolidated 102 means100 additional capacity and100 above-budget actual use. Neither voter is a submitter, and common control/link to a submitter is unproven.

## Rankings and awards

Actual tie rule: total DESC, submission.created_at DESC (newer wins tie); exact-time ties have no explicit tertiary key. Every entry under all six scenarios is in ranking-scenarios.csv. B scenarios are hypothetical sensitivity calculations, not authorized or recommended deletion lists. C and D equal observed results because there are no proven invalid wallet activities or justified disqualifications.

| Rank | Observed entry | Votes | Award |
| --- | --- | --- | --- |
| 1 | Candleman: The Roosters Invasion | 350 | 0.20 ETH |
| 2 | Fire Safety 101: Oops | 334 | 0.10 ETH |
| 3 | YELLOW COLLECTIVE: Rise of the Heroes | 327 | 0.075 ETH |
| 4 | Yellow Collective Conference | 233 | 0.05 ETH |
| 5 | THE YELLOW PAPER TAG LORE MAGA: EDITION 001 | 230 | 0.025 ETH |
| 6 | Nounish Cookies! | 164 | 1 Collective Noun |
| 7 | Doom scrolling | 140 | 1 Collective Noun |
| 8 | Yellow Tattoo | 134 | 1 Collective Noun |
| 9 | Oh Yeah-Low Minded | 132 | 1 Collective Noun |
| 10 | Yellow Meme | 130 | 1 Collective Noun |
| 11 | Yellow Pirate Crew Voyage | 125 | No award |
| 12 | Are you winning, Son? (Yellow Collective Edition) | 124 | No award |
| 13 | let’s do it | 107 | No award |
| 14 | Chicken - Yellowfrens comic | 88 | No award |
| 15 | Noggles Power | 82 | No award |
| 16 | I said YM! | 80 | No award |
| 17 | This is (not) Fine. | 42 | No award |
| 18 | Animal Right | 37 | No award |
| 19 | One Yellow collective nouns everyday forever | 36 | No award |
| 20 | Onchain guy | 24 | No award |

### Acute125 removed, conditional

| Rank | Entry | Votes | Observed rank | Award |
| --- | --- | --- | --- | --- |
| 1 | Fire Safety 101: Oops | 334 | 2 | 0.20 ETH |
| 2 | Candleman: The Roosters Invasion | 325 | 1 | 0.10 ETH |
| 3 | YELLOW COLLECTIVE: Rise of the Heroes | 277 | 3 | 0.075 ETH |
| 4 | Yellow Collective Conference | 233 | 4 | 0.05 ETH |
| 5 | THE YELLOW PAPER TAG LORE MAGA: EDITION 001 | 230 | 5 | 0.025 ETH |
| 6 | Nounish Cookies! | 164 | 6 | 1 Collective Noun |
| 7 | Doom scrolling | 140 | 7 | 1 Collective Noun |
| 8 | Oh Yeah-Low Minded | 132 | 9 | 1 Collective Noun |
| 9 | Yellow Meme | 130 | 10 | 1 Collective Noun |
| 10 | Yellow Pirate Crew Voyage | 125 | 11 | 1 Collective Noun |
| 11 | Are you winning, Son? (Yellow Collective Edition) | 124 | 12 | No award |
| 12 | let’s do it | 107 | 13 | No award |
| 13 | Chicken - Yellowfrens comic | 88 | 14 | No award |
| 14 | Yellow Tattoo | 84 | 8 | No award |
| 15 | Noggles Power | 82 | 15 | No award |
| 16 | I said YM! | 80 | 16 | No award |
| 17 | This is (not) Fine. | 42 | 17 | No award |
| 18 | Animal Right | 37 | 18 | No award |
| 19 | One Yellow collective nouns everyday forever | 36 | 19 | No award |
| 20 | Onchain guy | 24 | 20 | No award |

If the additional22 cba votes were justified for removal, Candleman would303; the first three positions remain Fire/Candle/Rise. The all 349 stress scenario includes unrelated votes cast by the NFT 355 pair and is intentionally not a recommendation.

## Risks and moderation mechanics

Admin PATCH bypasses normal eligibility, self-vote and budget validation but records before/after/reason. Current audit rows0 cannot exclude direct SQL, normal increments, historical deleted activity or configuration changes. Config cap is normally locked after voting starts and snapshot selection after resolution; base, strategy and deadline changes lack an immutable history. Current snapshot state establishes current ledger eligibility, not every earlier configuration.

Voting is closed, so normal recasting cannot occur. Deletion would free numerical capacity but cannot reopen voting. Ten stored winners are write-once; deleting votes or hiding/rejecting an entry does **not** recompute them. Any later authorized moderation must explicitly reconcile winner rows and award positions as a separate production action. No deletion/disqualification script is supplied or executed.

## Verification and limitations

- Blockscout complete returned collection transfer pagination:44pages,2192 events,960 token IDs; all relevant owners and supply agree with historical RPC. Source scope includes intermediate wallets and external delegators.
- Historical snapshot and cutoff contract state for 43 participants; 86 unique successful transaction receipts; 13 successful event-boundary historical call pairs. Critical transfer/delegation changes are also decoded from receipt logs.
- All33 returned DelegateChanged events captured; wallet-specific DelegateVotesChanged queries only 8/43 succeeded,35 returned429 even on sequential retry. Missing wallet-event histories are recorded; this prevents claiming exhaustive separate checkpoint-log coverage, while actual snapshot getVotes is verified.
- Two event-boundary call pairs remain429 (final presnapshot820 outbound and955 toTattoo); their receipt logs and snapshot/cutoff state are available. Secondary public RPC returned403; no secondary-RPC verification was achieved.
- Wallet native funding pages are bounded50-item windows, sometimes paginated further; internal calls, bridges, ERC20 funding and otherchains are not exhaustively reconstructed. External donor account linkage across other rounds remains incomplete.
- No complete perincrement vote history/config journal; external published rules and private account control not available. Technical ledger checks are complete for current records; common-control investigation is limited by these missing evidence categories.
- Independent source review: source-review.md. Full data reconciliation, exact review row IDs, chronological receipts and conditional scenario totals are reproducible from local artifacts using node build-report.cjs.

## Artifacts and reproduction

All files are in this timestamped audit directory. Required outputs: audit-report.md, votes.csv, wallet-summary.csv, transfer-and-delegation-evidence.csv, findings.csv, ranking-scenarios.csv, proposed-moderation.json, source-and-coverage-manifest.json. Raw snapshots, queries, deployment identities, receipts, historical states and scripts are preserved alongside them.

Run from repository root:

```powershell
node output/audits/comic-strips-20261001T204936Z/analyze-ledger.cjs
node output/audits/comic-strips-20261001T204936Z/build-report.cjs
# Live collection uses existing authorized Railway access and READ ONLY SQL:
railway run --project af512d4f-60b5-42a8-b7dc-bf337fa00c1d --environment production --service 9472c187-a023-46d2-b39e-4f42a88d3b51 --no-local -- node output/audits/comic-strips-20261001T204936Z/collect-db.cjs
```

Live recollection replaces database-snapshot.json: copy the original directory first and align chain cutoff before comparing scenarios. Existing pg/ethers packages and authenticated Railway CLI were used; no tools were installed. Report generator performs local reads/writes only.

**Production state changed by this investigation: none.** Only new audit artifacts were written. Existing source/dirty work preserved; no commits, pushes, deployments, transactions, contacts, source-note/plugin/automation edits or memory updates. Memory was read as historical context and all material findings above were freshly verified.

Final read-only live refresh at 2026-10-01T21:24:02.219Z: all 219 vote rows and ten stored winners unchanged; 2,919 votes, zero admin audit rows, no vote updated after the deadline. This confirms stability without changing the report cutoff.
