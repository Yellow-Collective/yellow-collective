const fs=require('fs'),path=require('path'),r=require('./results.json');
const short=w=>w.slice(0,8)+'…'+w.slice(-4);
const link=w=>`[${short(w)}](https://basescan.org/address/${w}) · [Yellow](https://www.yellowcollective.art/profile/${w})`;
const find=p=>r.coverage.find(x=>x.wallet.startsWith(p));
let text=`# Historical patterns across all 59 propaganda voters

## Findings

**The strongest historical leads are concentrated repeat support for submitters 215db and cb6, plus an older cohort of ac1a supporters voting for the current 7802 submitter. Voting behavior alone does not establish common ownership.** The separate Farcaster pass supplies account identity evidence.

Source: [fresh production snapshot](../../round-propoganda-2026-10-24T01-00-53-099Z/database-snapshot.json), extracted 24 October 2026 at 01:00:53 UTC. Historical comparisons stop at the propaganda close, 23 October at 21:00 UTC.

### 1. Concentrated repeat support

| Voter | Benefiting submitter | Prior votes for them / all prior votes | Current votes for them / all current votes | Supporting rounds |
|---|---|---:|---:|---:|
`;
for(const p of ['0x3ba02','0xae470','0x9ffa','0x4e2a','0xbe7','0xf1f5']){const w=find(p),s=w.support[0];text+=`| ${link(w.wallet)} | ${link(s.submitter)} | ${s.priorVotes}/${w.priorVotes} | ${s.currentVotes}/${w.currentVotes} | ${s.roundCount} |\n`;}
text+=`
- **3ba02:** All 45 retained votes went to 215db across two rounds: Window #1 received 15; TOO MUCH SLOP and Make Art Great Again received 15 each.
- **ae470:** 101/101 earlier votes went to 215db's El Heladero Pengu. This round it gave 45/51 to that submitter's three entries, plus 6 to Support Yellow Artists.
- **9ffa:** All 175 earlier votes went to cb6 across three rounds: Yellow Flamingo 100, Simple Yellow Stickers 25, Are You Winning Son 25, Yellow Collective Conference 25. This round it gave 15 to Support Yellow Artists and 15 to More Art, Less Algorithm. Exclusive support ended this round; loyal support remains an alternative explanation.
- **4e2a:** Yellow Sunset and El Heladero Pengu each received 101 votes in earlier rounds; the same submitter received 34 this round. Review the separate verified Farcaster account link before interpreting this as self-voting.
- **be7/Hellia:** Previously reported repeat support is confirmed: Yellow Flamingo 100 and Support Yellow Artists 15. Other entries also received votes.
- **f1f5:** Supported cb6 in five rounds, but also supported many other submitters. Aggregate concentration is weaker than 9ffa's.

Exact allocation IDs and denominators: [claim ledger](claim-ledger.json) and [complete calculations](results.json).

### 2. Current 7802 supporters have earlier voting connections

The four-wallet burst of 120 votes was already reported in the original final audit. This pass adds historical recurrence and later synchronized additions.

- On 19 October, **f7ae, 517186, 5eaa and e348** each gave 15 to We Can Make It and 15 to The Museum Has No Front Desk. They acted at 22:54:54.419, 22:55:49.223, 22:56:30.389 and 22:56:49.685 UTC: **120 votes for one submitter within 115.266 seconds**.
- ac1a placed the same 15 + 15 earlier that evening. e212 also eventually gave 15 to each entry. This is an exploratory cohort, not a proven common owner.
- On 22 October, e348 added Paint 6 / Slop 15 at 21:42:16.051; e212 added Museum 15 / Slop 15 / Draw 4 / Paint 2 at 21:43:16.869. Their final ballots overlap **92.16%** by normalized allocation mass and share four of five combined entries. Their earlier allocations were on different days; their full ballots were not cast together.
- **5eaa and 9234** had allocations 96.845 seconds apart in Yellow Characters and 273.789 seconds apart in Sticker Packs. Earlier shared recipients included ac1a's Margo / Yellow Characters Sticker Pack. This is the only pair with allocation times within five minutes in at least two rounds among these 59 wallets. Their full ballots differed substantially.
- Prior retained support for ac1a: e348 gave 92 in Characters and 25 in Stickers; 5eaa gave 101 in Characters and 25 in Stickers; e212 gave 25 in Stickers; 9234 gave 33 in Characters and 25 in Stickers. Removed ballots are absent from this extract, so other missing support cannot be interpreted as never having happened.

The saved [focused cohort](focused-cohort.json) contains every relevant row, timestamp and pair metric. Other voters also supported 7802; this is not an exhaustive ownership group.

### 3. Similarity and timing in context

- **59 current voters:** 44 had earlier retained votes; 15 first appeared in propaganda. All seven previously flagged wallets are among those 15.
- Only three full current ballots were identical: 282d, 5d69 and 8f3 each gave **15 solely to Draw or Die**. They voted 9.7–30.3 hours apart. Single-entry equality is weak evidence and compatible with ordinary fans.
- Of **1,711 current wallet pairs**, eight met both exploratory criteria: selection Jaccard ≥ 0.8 and normalized allocation overlap ≥ 0.8. Three are the single-entry trio, four are inside the known seven-wallet group, and one is e212/e348.
- **No pair met both similarity thresholds in two or more rounds.**
- **42/59 used their full budget.** This is common behavior.
- Twenty current wallet pairs had at least one allocation within five minutes. Shared timing alone is not ownership proof.

### 4. Reciprocity and same-address voting

- Eighteen pairs supported one another somewhere in retained history; four did so in propaganda: 72d4/a09aa, 72d4/cb6, 8661/cb6 and 9ab5/ed76. Ordinary mutual support is a plausible explanation.
- The most recurrent reciprocal pair was 9ab5/ba8e: Characters 78/80 votes, Stickers 25/25, Comics 25/25. Historical rules and independent account links are needed before alleging misconduct. ba8e is not a current propaganda submitter.
- **Current same-address self-votes: zero.** Distinct wallets verified to one account require the separate identity investigation.
- Earlier same-submitter-address matches total **15 rows / 427 votes**, confined to Future Yellow Rounds, Farcaster Nominations and Yellow Poster. Nomination/idea submitters may be proposing other people or ideas; historical rules have not been established. These matches are not automatically violations. See results.json.directSelf for exact rows.

## Risks and limitations

- Complete coverage means all 59 current voters' retained history. It does not mean every participant in all past rounds. Auxiliary records for other historical voters only cover entries by current submitters, so their full voting denominators are unknown.
- Six comic-strip allocations were previously removed at the user's direction. Current retained tables cannot reconstruct those removals or prove a wallet never supported someone.
- Eleven Trait Design rows (51 votes) appeared after propaganda closed. They are preserved in [post-close-rows.json](post-close-rows.json) and excluded from comparisons with previous rounds.
- Older budgets differ. Aggregate historical shares weight larger-budget rounds more heavily; per-round source rows and prior/current denominators are preserved.
- History timestamps are row creation times at millisecond precision and may not capture later changes to amounts.
- Wallets are not unique people. No fraud probability, statistical significance, intent or moderation decision is estimated.

## Recommendations

Prioritize verified account and onchain checks for 215db supporters, cb6 supporters and the 7802 cohort. Use this behavior to direct review. Independent identity evidence and the applicable historical rules determine whether a pattern supports a self-voting finding.

## Verification

[Nine checks passed](verification.json): totals, key uniqueness, source joins, per-voter reconciliation, the four-wallet 120-vote sum and timing, and direct self-address counts. The source hash, filters, joins and cutoffs are in [results.json](results.json). The analysis contains **1,042 scoped rows / 14,717 votes across eight rounds**, including **308 propaganda rows / 2,950 votes**. All scoped rows have valid keys and positive integer votes; no duplicate wallet/round/submission keys, orphan current votes, or non-approved/deleted submission rows were found.

Rerun from the repository root:

\x60\x60\x60powershell
node output/audits/all-voters-expanded-2026-10-24T00-59-39-194Z/history/analyze.cjs
node output/audits/all-voters-expanded-2026-10-24T00-59-39-194Z/history/build-report.cjs
\x60\x60\x60

## Complete per-voter coverage

| Wallet | Earlier rounds | Earlier rows / votes | Current rows / votes | Distinct retained submitters |
|---|---:|---:|---:|---:|
`;
for(const w of r.coverage)text+=`| ${link(w.wallet)} | ${w.roundCount-1} | ${w.priorRows}/${w.priorVotes} | ${w.currentRows}/${w.currentVotes} | ${w.submitterCount} |\n`;
fs.writeFileSync(path.join(__dirname,'report.md'),text);
