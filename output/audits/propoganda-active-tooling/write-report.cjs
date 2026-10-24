const fs=require('fs'),path=require('path');const D=path.resolve('output/audits/round-propoganda-2026-10-20T13-33-16-160Z');const rd=n=>JSON.parse(fs.readFileSync(path.join(D,n)));const db=rd('database-snapshot.json'),a=rd('analysis.json'),meta=rd('chain-metadata.json'),val=rd('audit-validation.json');
const link=w=>`[${w.slice(0,6)}…${w.slice(-4)}](https://www.yellowcollective.art/profile/${w}) · [BaseScan](https://basescan.org/address/${w})`;
const rows=ws=>ws.map(([w,n])=>`| ${link(w)} | ${n} | Owner unknown |`).join('\n');
const authorA='0x7802cc411bfe02655fadfa5b23f9db3382d84a44',authorB='0x215db99298af65306a4c60bd3b7612d5f60b03d7',authorC='0x15c6a4bf9023ad20c51cbea9992a5bccf83f3e7b',authorD='0xcb6eb98d0533dd42367cd064fc5b988814187527';
const findings=[
{id:'F01',kind:'coordination lead; self-voting unproven',beneficiary:authorA,entryTitles:['The Museum Has No Front Desk','We can make it!'],wallets:['0xf7aef946d3f2e58a3685166ace1fc3db76d614de','0x517186eefab9d631e7ddbed521740e84afd9b11f','0x5eaa352f438023f956f8e6bd581f37a67971e46b','0xe348b541dd51c5e7b32557f055f7205e6d8c0a6d'],votes:120,owner:'UNKNOWN',evidence:'Four wallets each allocated 15 to both entries between 2026-10-19T22:54:54.419190Z and 22:56:49.685609Z (115.266419 seconds). Three recipients had historical delegation from the same delegator at different times; only f7 retained that delegation at this snapshot. No NFT Transfer or DelegateChanged directly connects these voters to beneficiary 7802 in the scanned contract.'},
{id:'F02',kind:'verified NFT relationship; common control unproven',beneficiary:authorB,entryTitles:['TOO MUCH SLOP','Make Art Great Again','Free the DAO'],wallets:['0x4e2a3a65d0e2bcdb507a70fe2d3fc5dff464aa25'],votes:34,owner:'UNKNOWN',evidence:'Submitter initiated transferFrom for token 318 to the voter on 2026-08-08; verified successful receipt. The voter placed 15+15+4 votes on submitter entries and 17 votes on other entries. Five-round retained platform history. Transfer could be gift, sale or custody.'},
{id:'F03',kind:'voting pattern only',beneficiary:authorC,entryTitles:['Draw or Die! 🫀 by msmeghna'],wallets:['0x5d69c42a3a481d0ccfd88cfa8a2a08e2bf456134','0x8f3a83a3356d2666d89d027544bbaffa12139e3c','0x282d656a9d95c64522f6bc1a42ee759de81e8dc0'],votes:45,owner:'UNKNOWN',evidence:'Each wallet has one retained platform allocation, 15 to this entry. Their NFT holdings predate this round substantially, and no direct NFT transfer/delegation connects them to the beneficiary. New platform voters are not necessarily new wallets.'},
{id:'F04',kind:'voting pattern only',beneficiary:authorD,entryTitles:['Support Yellow Artists'],wallets:['0x9ffaab6c24d4fb58d61b26b08c8795e9e323f28b'],votes:15,owner:'UNKNOWN',evidence:'Five of six retained platform allocations favor this submitter across four rounds, 190 of 205 historical votes; current 15 favors this entry and 15 favors More Art, Less Algorithm. Token 339 acquired through auction in 2024. No direct beneficiary NFT/delegation link.'}
];
for(const f of findings)f.allocations=db.votes.filter(v=>f.wallets.includes(v.wallet_address.toLowerCase())).filter(v=>db.submissions.find(s=>s.id===v.submission_id)?.wallet_address.toLowerCase()===f.beneficiary).map(v=>({id:v.id,submissionId:v.submission_id,votes:v.vote_count,createdAt:v.created_at,wallet:v.wallet_address.toLowerCase()}));
fs.writeFileSync(path.join(D,'findings.json'),JSON.stringify(findings,null,2));
const report=`# Yellow Propoganda — provisional vote audit

**Result: no verified self-voting. Two relationships merit closer review; wallet ownership remains unknown.**

**Cutoff:** October 20, 2026, 9:33:16 a.m. Eastern (13:33:16 UTC). Voting ends October 23 at 5 p.m. Eastern. Results can change.

Checked **40 voters / 202 allocations / 1,779 votes / 22 active entries**. All voters were eligible at the snapshot; no wallet exceeded its vote budget or the 15-vote entry cap. No direct self-votes. No votes were changed.

## 1. Highest review priority: two entries by ${link(authorA)}

**The Museum Has No Front Desk + We can make it!**

Four wallets voted **30 each, 120 total**, within **115 seconds**. Each gave 15 to each entry.

| Voting wallet | Votes to these entries | Believed owner |
|---|---:|---|
${rows(findings[0].wallets.map(w=>[w,30]))}

**OBSERVED:** f7ae, 5eaa and e348 have historical links to the same external delegator, ${link('0x33bffd2f818c79b9c6eb38193e32c5b5d17176c6')}. Those delegations occurred at different times. f7ae had 1 NFT plus 1 delegated vote at this snapshot; 5eaa/e348 each had 1 NFT and 1 voting power. This was not the same NFT simultaneously supplying all four wallets at the snapshot.

**INFERRED:** coordinated support is plausible. **UNKNOWN:** who operated these wallets; no direct NFT/delegation link to submitter 7802 was found. Supporters may have responded to the same request to vote. The fourth wallet, 5171, has no direct NFT/delegation link to this group established here.

## 2. Verified NFT connection: entries by ${link(authorB)}

| Voting wallet | Votes to this submitter | Believed owner |
|---|---:|---|
${rows([[findings[1].wallets[0],34]])}

**34 votes:** TOO MUCH SLOP **15**; Make Art Great Again **15**; Free the DAO **4**.

**OBSERVED:** the submitter sent NFT **318** to this voter on **August 8**, using a sender-initiated transferFrom. [Verified transaction](https://basescan.org/tx/0x302072f37a511d291ec55a62c0c0144c64eee30a170e5f52ba4150dc70c1f6bd). This voter also allocated **17 votes elsewhere** and appears in **five rounds**.

**UNKNOWN:** common ownership. The transfer predates this round by over two months and could be a gift, sale or custody arrangement. Two other wallets, ${link('0xae4705dc0816ee6d8a13f1c72780ec5021915fed')} (**45**) and ${link('0x3ba02da5b9fe77aed5592e934f7ec15381b3dded')} (**30**), concentrate support on this submitter, but no direct NFT/delegation link to that submitter was found. Treat those 75 votes as pattern-only leads.

## 3. Lower-confidence leads

**Draw or Die! by msmeghna** — submitter ${link(authorC)}:

| Voting wallet | Votes to this entry | Believed owner |
|---|---:|---|
${rows(findings[2].wallets.map(w=>[w,15]))}

**45 total.** Each has voted only for this entry in retained platform records. Their NFTs were held long before this round. No direct NFT/delegation connection to the submitter was found. This supports a review question, not an ownership attribution.

**Support Yellow Artists** — submitter ${link(authorD)}: ${link(findings[3].wallets[0])} placed **15 votes**. Five of its six retained allocations favor this submitter across four rounds, but it also voted for another artist. No direct NFT/delegation connection to the submitter was found. Owner unknown.

## Recommendation

Request an explanation for **F01's coordinated 120 votes** and **F02's transferred-NFT voter with 34 votes** before awards. Available evidence does not establish a submitter controlling side wallets, so it does not support an automatic removal or disqualification. Recheck after voting closes.

## Evidence and limits

Production DB was collected in a repeatable-read, read-only transaction and rolled back. **23 submission records include one deleted entry with zero votes; 22 are active.** Zero orphaned allocations; zero moderation records; no stored winners yet. Ten award definitions exist.

Chain evidence covers the configured Collective Nouns contract on Base from **block 0 through 52,856,924**, in **53 contiguous ranges**, with no failed ranges or duplicate events: **2,242 Transfer**, **34 DelegateChanged**, **3,373 DelegateVotesChanged** events. Voting eligibility snapshot: **52,697,526**, October 16 at 20:59:59 UTC. Reconstructed ownership and delegation match all 40 voters' historical balance/voting-power reads. **973 minted token IDs minus 132 burns = 841 live tokens**, matching totalSupply. Five material receipts were independently checked using Base's primary RPC and all 15 corresponding logs matched.

Full chain event coverage is for this NFT contract only. General ETH funding, other NFTs/contracts, cross-chain activity, device/IP evidence and private identities were not established. Retained DB history cannot recover deleted or previously removed ballots. Blockscout requests were blocked; public RPC succeeded. Some exploratory archive receipt requests returned null; successful material receipt checks are saved separately. Equal vote totals are ties; ranking scenarios do not apply an official tie-break rule.

Files: findings.json, analysis.json, wallet-patterns.json, database-snapshot.json, rpc-events.json, historical-state.json, material-receipts.json, audit-validation.json, rankings-scenarios.json and evidence-appendix.md.
`;
fs.writeFileSync(path.join(D,'audit-report.md'),report);
const participants=[...new Set([...db.votes,...db.submissions].map(x=>x.wallet_address.toLowerCase()))].sort();
const appendix=`# Evidence appendix — Yellow Propoganda

Round: ${db.round.id} / propoganda. Database cutoff: ${db.metadata.cutoff}. Chain: Base 8453, contract ${meta.contract}. Code revision: a4b697cbdf50d53f56bf3935431f754d2c83446d. Local source was inspected; deployed source parity was not independently established.

## Reproduction

From repository root, run the saved active-round collector through Railway with explicit production identifiers:

\`railway run --project af512d4f-60b5-42a8-b7dc-bf337fa00c1d --environment production --service 9472c187-a023-46d2-b39e-4f42a88d3b51 --no-local -- node output/audits/propoganda-active-tooling/collect-active.cjs --round propoganda\`

This collector explicitly permits an active round for this request. DB TLS verifies the service CA plus an exact leaf-certificate pin, both retrieved from the named service through user-approved SSH. The certificate has localhost as its hostname, so the authenticated service certificate pin supplies service identity. rejectUnauthorized remains true. No DB credentials were saved. Temporary audit SSH registration was revoked after certificate retrieval. The pre-existing public SSH key registration and approved Railway known-host entry remain.

The collector writes a fresh UTC folder. Saved chain collection/analysis scripts use this audit's explicit folder; select the new cutoff folder before a new run. collect-rpc-full.cjs scans genesis through the cutoff; collect-rpc.cjs was an exploratory cached-history delta and is not the final history source. An older file supplies only a binary-search lower bound in the final collector; final events come entirely from fresh RPC reads.

## Rules

DB: base_plus_voting_power; base votes 50; per-entry cap 15; voting_start snapshot 52697526. Historical getVotes must be positive. Budget is 50 + getVotes. Source: utils/rounds/getRoundVotingPower.ts and utils/rounds/getCollectiveNounVotingPower.ts. data/rounds.ts rejects same-address self-votes and allocations to deleted/unapproved entries. This audit does not infer that every transferred NFT or delegation violates a round rule. Stored round text was preserved in database-snapshot.json.

## Material delegation receipts

${rd('material-receipts.json').map(r=>`- [${r.hash}](https://basescan.org/tx/${r.hash}) — status ${r.receipt.status}; matched raw event logs.`).join('\n')}

## Every participant

| Wallet | Yellow profile | BaseScan |
|---|---|---|
${participants.map(w=>`| ${w} | [Profile](https://www.yellowcollective.art/profile/${w}) | [BaseScan](https://basescan.org/address/${w}) |`).join('\n')}

## Verification

See audit-validation.json for counts, exclusions, supply/burn reconciliation, snapshot voting power, exact range coverage and receipt matches. Event ranges are comfortably below 1,000 logs each (largest 341); no offset pagination was needed. No evidence of omitted logs was found in state reconciliation, although a single RPC aggregator is not independent proof of every historical event.
`;
fs.writeFileSync(path.join(D,'evidence-appendix.md'),appendix);
console.log(JSON.stringify({report:path.join(D,'audit-report.md'),findings:findings.length,participants:participants.length}));
