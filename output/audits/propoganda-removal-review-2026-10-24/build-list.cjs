const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..'),audit=path.join(base,'all-voters-expanded-2026-10-24T00-59-39-194Z');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(path.join(base,'round-propoganda-2026-10-24T01-00-53-099Z/database-snapshot.json'));
const fc=read(path.join(audit,'farcaster/analysis.json'));
const round='e7c5cc86-dbc3-43fc-8ff1-795d4b997c33';
const subs=new Map(db.submissions.map(s=>[s.id,s]));
const list=[];
function add(prefix,accept,tier,reason,source){
 const rows=db.votes.filter(v=>v.wallet_address.toLowerCase().startsWith(prefix)&&accept(subs.get(v.submission_id),v));
 assert.ok(rows.length,'No allocations: '+prefix);
 for(const v of rows){const s=subs.get(v.submission_id);list.push({section:'ranked',tier,reason,source,allocation_id:v.id,round_id:v.round_id,voter:v.wallet_address.toLowerCase(),submission_id:s.id,submission:s.title,submitter:s.wallet_address.toLowerCase(),votes:v.vote_count});}
}
const author=a=>s=>s.wallet_address.toLowerCase().startsWith(a);
const title=t=>s=>s.title===t;
add('0x4e2a',author('0x215db'),'High','Nadiecito: voter and submitter verified to one Farcaster account.','farcaster/analysis.json');
add('0x3ba02',author('0x215db'),'Medium','Nadiecito: seven ETH links; all retained votes support them. Owner unverified.','connections.md;history/report.md');
for(const p of ['0xb897','0x79ed'])add(p,title('💛Paint the world Yellow💛'),'Medium','Received NFT from Valentina; voted for her entry. Owner unverified.','onchain-screen.json');
add('0xae470',author('0x215db'),'Low','146/152 retained votes support Nadiecito; owner unverified.','history/report.md');
add('0x9ffa',title('Support Yellow Artists'),'Low','190/205 retained votes support this submitter; owner unknown.','history/report.md');
for(const p of ['0xf7ae','0x517186','0x5eaa','0xe348'])add(p,author('0x7802'),'Low','Four-wallet, 120-vote cluster within 115 seconds; ownership unproven.','history/focused-cohort.json');
// Later near-synchronous additions are a distinct lead; do not relist earlier rows.
add('0xe212',(s,v)=>Date.parse(v.created_at)>=Date.parse('2026-10-22T21:43:16Z')&&Date.parse(v.created_at)<Date.parse('2026-10-22T21:43:18Z'),'Very low','Additions near e348; similar final ballot. Ownership unproven.','history/focused-cohort.json');
add('0xe348',(s,v)=>Date.parse(v.created_at)>=Date.parse('2026-10-22T21:42:16Z')&&Date.parse(v.created_at)<Date.parse('2026-10-22T21:42:18Z'),'Very low','Additions near e212; similar final ballot. Ownership unproven.','history/focused-cohort.json');
add('0x2262',title('Support Yellow Artists'),'Very low','Received one old ETH payment from submitter; purpose unknown.','cb6-2262-0.json;cb6-2262-1.json');
add('0xbe7',title('Support Yellow Artists'),'Very low','Hellia: 115/139 votes support submitter; no ownership match.','history/report.md;farcaster/analysis.json');
for(const p of ['0xdc37','0x0b81','0xeb8a','0x0816','0x0756','0xb15a','0x3147'])add(p,()=>true,'Very low','Seven-wallet voting/financial cluster; no submitter ownership match.','farcaster/report.md;../seven-wallet-cluster-2026-10-24T00-08-23-115Z/report.md');
const conditional=[];
for(const g of fc.sameAccountVoterGroups)for(const v of g.ballots){const s=subs.get(v.submission_id);conditional.push({section:'policy-dependent',tier:'Account link high; violation unresolved',reason:g.username+': two verified voting wallets; no current self-vote established.',source:'farcaster/analysis.json',allocation_id:v.id,round_id:v.round_id,voter:v.wallet_address.toLowerCase(),submission_id:s.id,submission:s.title,submitter:s.wallet_address.toLowerCase(),votes:v.vote_count});}
const ranks={'High':0,'Medium':1,'Low':2,'Very low':3};list.sort((a,b)=>ranks[a.tier]-ranks[b.tier]);
const all=[...list,...conditional],ids=new Set();
for(const r of all){assert.equal(r.round_id,round);assert.ok(!ids.has(r.allocation_id),'Duplicate '+r.allocation_id);ids.add(r.allocation_id);const found=db.votes.filter(v=>v.id===r.allocation_id);assert.equal(found.length,1);assert.equal(found[0].vote_count,r.votes);assert.equal(found[0].submission_id,r.submission_id);assert.equal(found[0].wallet_address.toLowerCase(),r.voter);assert.equal(subs.get(r.submission_id).status,'approved');assert.ok(!subs.get(r.submission_id).deleted_at);}
const sum=rows=>rows.reduce((n,r)=>n+r.votes,0);
assert.equal(sum(list.filter(r=>r.tier==='High')),34);
assert.equal(conditional.length,22);assert.equal(sum(conditional),206);
const wallet=a=>`[${a.slice(0,8)}…${a.slice(-4)}](https://www.yellowcollective.art/profile/${a}) · [↗](https://basescan.org/address/${a})`;
const table=rows=>'| Confidence | Voter | Submission | Votes | Brief reason |\n|---|---|---|---:|---|\n'+rows.map(r=>`| ${r.tier} | ${wallet(r.voter)} | ${r.submission} | ${r.votes} | ${r.reason} |`).join('\n')+'\n';
const report=`# Propaganda: final vote-removal review list

**Strongest case: 34 votes from Nadiecito's verified second wallet.** All other self-vote candidates have unresolved ownership. Lower tiers are review leads, not sufficient grounds for removal by themselves.

Based on the saved production snapshot from **October 24, 2026, 01:00:53 UTC**; production was not refreshed for this synthesis. Counts below are existing allocations under review, not approved deletion amounts. Each row is one voter and one submission. Ties within a tier are not meaningfully ordered.

## Ranked candidates: highest to lowest confidence

${table(list)}
## Separate policy question: verified multi-wallet ballots

Both accounts used two verified wallets. No current self-vote was established. A one-person/account voting restriction must apply before these become removal candidates; the per-wallet checks passed. All allocations are listed so neither wallet is arbitrarily selected for deletion. These 206 votes are not a recommended removal total. Catra's combined entry totals exceed 15 for Support Yellow Artists (25) and YELLOW IS EVERYWHERE (20); Nounci's for On-chain Art for All (20).

${table(conditional.map(r=>({...r,tier:'Policy-dependent'})))}
## Exclusions and limits

- Prior-round own-entry votes support the ranking but are excluded from this Propaganda list. Pramadan's verified second wallet cast zero current votes for their submission. 3b6a is linked to Nounci, not Pramadan.
- The seven-wallet group has seven distinct public Farcaster accounts. Current follows, old payments, gifts/sales and shared-service funding do not establish a common operator. All 31 allocations from that group are shown consistently because the lead concerns the group, not only its first-place vote.
- Isolated single-entry matches, full-budget use, reciprocity and ordinary earlier support alone were not added. ac1a/9234's weaker historical cohort links remain in the full audit rather than becoming additional removal candidates.
- Times are cumulative allocation-record timestamps, not a complete history of individual vote casts. No probability of misconduct is assigned.

[Full evidence report](../all-voters-expanded-2026-10-24T00-59-39-194Z/report.md) · [Exact allocation IDs and evidence references](candidates.json) · [CSV](candidates.csv) · [Executed prompt](prompt.md) · [Validation](checks.json).

**No production votes, rankings or moderation were changed.**
`;
fs.writeFileSync(path.join(__dirname,'report.md'),report);
fs.writeFileSync(path.join(__dirname,'candidates.json'),JSON.stringify({snapshot:'2026-10-24T01:00:53.099Z',evidenceRoot:audit,ranked:list,policyDependent:conditional},null,2));
const fields=['section','tier','voter','submission','votes','reason','allocation_id','submission_id','round_id','submitter','source'];
const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(__dirname,'candidates.csv'),fields.join(',')+'\n'+all.map(r=>fields.map(k=>csv(r[k])).join(',')).join('\n')+'\n');
const checks={allRowsJoinSnapshot:true,uniqueAllocationIds:true,currentRoundOnly:true,approvedActiveOnly:true,highConfidenceVotes:34,rankedRows:list.length,policyRows:conditional.length,byTier:Object.keys(ranks).map(tier=>({tier,rows:list.filter(r=>r.tier===tier).length,votes:sum(list.filter(r=>r.tier===tier))})),policyVotes:sum(conditional)};
fs.writeFileSync(path.join(__dirname,'checks.json'),JSON.stringify(checks,null,2));
console.log(JSON.stringify(checks));
