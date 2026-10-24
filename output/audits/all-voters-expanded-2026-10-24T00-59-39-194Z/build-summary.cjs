const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = __dirname;
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const fc = read('farcaster/analysis.json');
const chain = read('onchain-screen.json');
const refresh = read('refresh-comparison.json');
const own = fc.sameAccountVotes.filter(r => !r.sameWallet);
const sum = rows => rows.reduce((s, r) => s + r.vote_count, 0);
const checks = [];
function check(name, condition) { assert.ok(condition, name); checks.push({name, passed:true}); }
check('Nadiecito 34 current and 202 earlier votes', sum(own.filter(r => r.fid === 15069 && r.round_slug === 'propoganda')) === 34 && sum(own.filter(r => r.fid === 15069 && r.round_slug !== 'propoganda')) === 202);
check('Pramadan 120 earlier and zero current same-account votes', sum(own.filter(r => r.fid === 471160)) === 120 && !own.some(r => r.fid === 471160 && r.round_slug === 'propoganda'));
check('Nounci 25 earlier own-account votes', sum(own.filter(r => r.fid === 810468)) === 25);
check('Every cited cross-wallet verification predates allocation', own.every(r => Date.parse(r.voterVerification) < Date.parse(r.created_at) && Date.parse(r.submitterVerification) < Date.parse(r.created_at)));
check('Two multi-wallet accounts with 103 votes each', fc.sameAccountVoterGroups.length === 2 && fc.sameAccountVoterGroups.every(g => g.wallets.length === 2 && sum(g.ballots) === 103));
check('All 70 Base normal-history pages exhausted', chain.coverage.length === 70 && chain.coverage.every(c => c.status === 'ok' && c.complete));
check('Fresh production current votes unchanged and read only', refresh.equal.votes && refresh.equal.submissions && refresh.equal.moderation && refresh.readOnly === 'on');
const tx = read('cb6-2262-0.json').structuredContent.data.result;
const receipt = read('cb6-2262-1.json').structuredContent.data.result;
check('First-place author payment has successful receipt and exact value', tx.from === '0xcb6eb98d0533dd42367cd064fc5b988814187527' && tx.to === '0x2262d4288f35b75831f0b132a7b1fcf719430274' && BigInt(tx.value) === 13430000000000000n && receipt.status === '0x1');
const addresses = [...new Set([...chain.coverage.map(x => x.wallet), '0xcd295a33541d5aeb259c05ad51ef12b5e7fa30c1'])];
const full = prefix => { const a = addresses.filter(x => x.startsWith(prefix)); assert.equal(a.length, 1, prefix); return a[0]; };
const link = prefix => { const a = full(prefix); return '[' + a.slice(0, 8) + '…' + a.slice(-4) + '](https://basescan.org/address/' + a + ') · [Yellow profile](https://www.yellowcollective.art/profile/' + a + ')'; };
let report = `# Expanded Propaganda vote audit

**Reviewed all 59 current voters and their retained history across eight rounds.** Production refreshed October 24, 2026 at 01:00:53 UTC. Historical comparisons stop at the October 23, 21:00 UTC voting close.

## Findings — strongest evidence first

### 1. Nadiecito: 34 current votes for their own entries

**High confidence account connection:** voter ${link('0x4e2a')} and submitter ${link('0x215db')} are both verified to [@nadiecito.eth, FID 15069](https://farcaster.xyz/nadiecito.eth).

| Entry | Current votes from the second wallet |
|---|---:|
| TOO MUCH SLOP | 15 |
| Make Art Great Again | 15 |
| Free the DAO | 4 |
| **Total** | **34** |

The same wallet gave **202 earlier votes** to this submitter: Yellow Sunset 101 and El Heladero Pengu 101. Total retained cross-wallet own-entry votes: **236**. Both verification timestamps predate the votes. NFT #318 also moved from the submitting wallet to the voting wallet. [Verification response](farcaster/verifications-15069.json) · [NFT transfer](https://basescan.org/tx/0x302072f37a511d291ec55a62c0c0144c64eee30a170e5f52ba4150dc70c1f6bd).

**Two additional Nadiecito-supporting wallets need review:**

| Wallet | Current votes for Nadiecito | Why flagged | Ownership conclusion |
|---|---:|---|---|
| ${link('0x3ba02')} | 30 | All 45 retained votes across two rounds support Nadiecito; seven direct ETH transfers between the wallets, totaling 0.13516 ETH gross in 2024–2025 | Meaningful financial connection; common owner unverified |
| ${link('0xae470')} | 45 | 146/152 retained votes across two rounds support Nadiecito | Concentrated support; common owner unverified |

The 34 verified-account votes and 75 unresolved votes are separate evidence tiers. Do not describe all 109 as confirmed self-votes. ae470 has ENS name noun22.eth, but the discovered Farcaster noun22 account does not verify this address.

### 2. Catra and Nounci: two verified voting wallets each

| Public account | Voting wallets | Combined current votes | Current own-entry votes established |
|---|---|---:|---:|
| [Catra / @catra.eth](https://farcaster.xyz/catra.eth), FID 9318 | ${link('0x036cd')} and ${link('0xe8bb')} | **103** | None |
| [Nounci / @nounci](https://farcaster.xyz/nounci), FID 810468 | ${link('0x97c8')} and ${link('0x3b6a')} | **103** | None |

These are verified same-account multiple-wallet ballots. No verified wallet from either account matches a current submitter. Catra's wallets together gave Support Yellow Artists 25 and YELLOW IS EVERYWHERE 20; Nounci's gave Onchain Art for All 20. These exceed 15 when grouped by account, while each individual wallet complied with its per-entry cap. Whether account aggregation is prohibited depends on the applicable policy. [Exact allocations and identity joins](farcaster/analysis.json).

### 3. Historical same-account own-entry votes

| Account | Second wallet | Retained earlier votes for own submissions |
|---|---|---|
| Nadiecito | ${link('0x4e2a')} | **202:** Yellow Sunset 101; El Heladero Pengu 101 |
| [Pramadan / @pramadan.eth](https://farcaster.xyz/pramadan.eth) | ${link('0xcba18')} | **120:** Yellow Summer 80; Candleman 10; Mr. Candle 10; Yellow Frens 20 |
| Nounci | ${link('0x3b6a')} | **25:** Yellow Meme, comic-strip round |

**Correction to earlier suspected ownership:** 3b6a is verified to Nounci's Farcaster account, including as its custody address. It should not be assigned to Pramadan merely because Pramadan transferred an NFT to it. Pramadan's verified cba18 wallet cast **zero votes for Perpetual this round**. Historical totals reflect retained rows after prior moderation, not an original unmodified ballot archive. Historical policy must be checked before calling these violations. [Verification evidence and dates](farcaster/report.md).

### 4. Support Yellow Artists / first-place submitter

Submitter: ${link('0xcb6')} — verified Farcaster identity remains unknown.

| Voter/group | Current Support Yellow Artists votes | Additional evidence | Assessment |
|---|---:|---|---|
| ${link('0x9ffa')} | 15 | 190/205 retained votes across four rounds support cb6; all 175 earlier votes did | Strong repeat-support pattern; owner unknown |
| ${link('0x2262')} | 15 | cb6 sent it 0.01343 ETH on June 30, 2025 | Direct financial connection; one old payment does not prove ownership |
| Hellia ${link('0xbe7')} | 15 | Earlier Yellow Flamingo received 100; 115/139 total retained votes support cb6 | Repeat support; no verified shared account |
| Previously examined seven-wallet group | 105 | All seven gave 15; older financial/NFT network and late voting window | Connected group; not linked to cb6 by verified ownership |

The 2262 payment was checked against its full transaction and successful receipt. [Payment](https://basescan.org/tx/0x1ac33170f61cf96225e13bdcb9bff21d292b334a8c0e4794ffab32ca28504a70). 9ffa's prior support includes **Yellow Collective Conference, 25 votes**, alongside Yellow Flamingo 100, Simple Yellow Stickers 25 and Are You Winning Son 25. Loyal supporters remain a plausible explanation.

### 5. Seven-wallet group: public accounts and social connections

| Wallet | Verified Farcaster account |
|---|---|
| ${link('0xdc37')} | [amirk.eth](https://farcaster.xyz/amirk.eth) — FID 492896 |
| ${link('0x0b81')} | [mahnaz.eth](https://farcaster.xyz/mahnaz.eth) — FID 492908 |
| ${link('0xeb8a')} | [namirai](https://farcaster.xyz/namirai) — FID 814425 |
| ${link('0x0816')} | [daving](https://farcaster.xyz/daving) — FID 689506 |
| ${link('0x0756')} | [moonza](https://farcaster.xyz/moonza) — FID 847004 |
| ${link('0xb15a')} | [miniom](https://farcaster.xyz/miniom) — FID 938012 |
| ${link('0x3147')} | [desdot](https://farcaster.xyz/desdot) — FID 815212 |

- All seven follow **Pramadan**, the Perpetual submitter. Six follow **Redykay**; Daving is the exception in the returned lists. Earlier onchain creator/mint relationships also connect parts of the group to these artists.
- Amirk, Mahnaz, Namirai, Daving, Desdot and Hellia form a mutually following core. Moonza and Miniom each follow that core.
- Their seven wallet verifications date to **2024–January 2025**. Each has a distinct FID and verified address set; none matches the 18 current submitter addresses. Separate accounts do not prove separate human operators.
- **Support Yellow Artists was not the only unanimous choice:** all seven also supported **Yellow🟡 The Culture We Own** (66 combined votes). Six supported We Can Make It (72). Their first retained round voting occurred within roughly 34 minutes near the close.
- Hellia is verified as [hellia.eth, FID 792867](https://farcaster.xyz/hellia.eth). Outside intermediary ${link('0xcd295')} remains unidentified. No verified ownership connection from these accounts to cb6 was established.

Follow relationships are current social evidence, not proof of coordination at voting time. [Full Farcaster findings](farcaster/report.md) · [Earlier ownership/mint investigation](../seven-wallet-ownership-2026-10-24T00-43-36-683Z/report.md) · [NFT acquisition timelines](../seven-wallet-cluster-2026-10-24T00-08-23-115Z/report.md).

### 6. Repeated voting connections around We Can Make It / Museum

Submitter ${link('0x7802')}: **f7ae, 517186, 5eaa and e348 cast 120 combined votes for its two entries within 115.266 seconds** on October 19. Each gave 15 to each entry.

- Earlier rounds connect several of these supporters to ${link('0xac1a')}: 5eaa, e348, e212 and 9234 previously supported Margo and/or Yellow Characters Sticker Pack.
- 5eaa and 9234 placed allocations within five minutes of each other in two earlier rounds. Their complete ballots differed.
- e348 and e212 made later additions **60.818 seconds apart** on October 22; their final ballots have **92.16% normalized allocation overlap**. Their complete ballots were not cast together.
- The four burst wallets received small internal ETH transfers through the same contract and parent sender. This shared funding route is an unresolved service/intermediary lead, not evidence that a submitter controls the wallets. No verified Farcaster ownership match to 7802 or ac1a was found.

[Full wallet links, timestamps and historical rows](history/report.md) · [Exact cohort calculations](history/focused-cohort.json) · [Funding trace appendix](connections.md).

### 7. Other checks and counterevidence

- Valentina's NFT-transfer lead remains: ${link('0xb897')} and ${link('0x79ed')} received Collective NFTs from ${link('0x9ab5')} and each gave Paint 15 votes, **30 combined**. Common ownership remains unverified.
- Three wallets voted identically with 15 solely to Draw or Die, but voted 9.7–30.3 hours apart. This is weak evidence of anything beyond shared preference.
- No wallet pair met both exploratory high-similarity thresholds in two or more rounds. Full-budget voting was common: 42/59 voters.
- Current same-address self-votes: zero. The original pinned onchain review found all 59 eligible and zero per-wallet cap/budget violations. Same-account cross-wallet voting requires the additional identity analysis above.
- Historical same-address matches include nominations and ideas; a nominator is not necessarily the artist. Those rows are not automatically improper self-votes.

## Recommendations

1. Prioritize the **34 Nadiecito same-account votes** for a policy-based moderation decision.
2. Review **Catra and Nounci's two-wallet ballots** against any one-person or account-level voting rule.
3. Keep the 3ba02, ae470, cb6-supporter and 7802-cohort cases as unresolved ownership leads. Voting patterns, payments, social follows and NFT transfers alone are insufficient to attribute every wallet to the beneficiary.
4. Review historical same-account votes under each round's actual rules and original moderation record. This report does not automatically recommend retroactive disqualification.

## Verification and coverage limits

- Fresh Railway production snapshot used a read-only transaction with verified TLS. Current submissions, 308 allocation rows / 2,950 votes, moderation, winners and awards match the prior final snapshot.
- All **59 current voters' retained history** was screened: **1,042 rows / 14,717 votes across eight rounds**. Eleven later Trait Design rows were excluded. This is not a new audit of every person who ever voted in every past round. Previously deleted votes are absent.
- Base normal transaction history: all **70 unique current voter/submitter addresses**, blocks 0–53,000,299, provider pagination exhausted; **131,496 returned address-history rows** before cross-address deduplication. Successful native ETH edges were deduplicated by hash.
- Reused complete Collective NFT/delegation event ranges through that cutoff and historical eligibility at snapshot block 52,697,526. Additional internal-history checks covered eight selected wallets. Internal transfers, other tokens and other chains were not exhaustively collected for all voters.
- Exact Farcaster verification matches: **36/59 voters, 12/18 submitters; 42/71 unique investigated addresses**. The remaining 29 are unknown. Authenticated reverse-address discovery was unavailable; public candidate discovery can miss accounts.
- Public Farcaster verification records establish current account/address membership and report timestamps predating the cited ballots. Raw signatures and full removal/re-addition/custody history were not independently replayed. Findings identify public accounts, not legal identities or intent.
- [Summary checks](summary-checks.json), [nine historical checks](history/verification.json), [Farcaster checks](farcaster/checks.json), [per-voter historical coverage](history/report.md), [identity coverage CSV](farcaster/coverage.csv), [chain coverage and exact edges](onchain-screen.json).

**Only local audit artifacts were written. Production votes, rankings, moderation, source code, account settings and messages were unchanged. Memory was read, not updated.**
`;
fs.writeFileSync(path.join(root, 'report.md'), report);
fs.writeFileSync(path.join(root, 'summary-checks.json'), JSON.stringify({checkedAt:new Date().toISOString(),checks},null,2));
const headers = ['fid','username','round_slug','submission_title','wallet_address','submitting_wallet','vote_count','id','voterVerification','submitterVerification'];
const csv = v => '"'+String(v??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(root, 'same-account-own-votes.csv'), headers.join(',')+'\n'+own.map(r=>headers.map(k=>csv(r[k])).join(',')).join('\n')+'\n');
console.log(JSON.stringify({report:path.join(root,'report.md'),checks:checks.length,ownAllocationRows:own.length}));
