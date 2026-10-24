const fs=require('fs'),path=require('path'),assert=require('assert');
const r=require('./results.json'),d=JSON.parse(fs.readFileSync(r.quality.source));
const h=d.voter_history.filter(x=>Date.parse(x.created_at)<=Date.parse(d.round.voting_ends_at));
const short=w=>w.slice(0,8)+'…'+w.slice(-4),links=w=>`[${short(w)}](https://basescan.org/address/${w}) · [Yellow](https://www.yellowcollective.art/profile/${w})`;
const sum=rows=>rows.reduce((n,x)=>n+Number(x.vote_count),0),lookup=p=>r.coverage.find(x=>x.wallet.startsWith(p));
const familyPrefixes=['0xf7ae','0x517186','0x5eaa','0xe348','0xac1a','0xe212','0x9234'];
const family=familyPrefixes.map(lookup),owner780='0x7802cc411bfe02655fadfa5b23f9db3382d84a44';
const familyRows=h.filter(x=>family.some(w=>w.wallet===x.wallet_address));
const focused={family:family.map(x=>x.wallet),rows:familyRows,overlapPair:r.currentPairs.find(x=>x.a.startsWith('0xe212')&&x.b.startsWith('0xe348')),repeatedTimingPair:r.recurrent.find(x=>x.a.startsWith('0x5eaa')&&x.b.startsWith('0x9234'))};
fs.writeFileSync(path.join(__dirname,'focused-cohort.json'),JSON.stringify(focused,null,2));
const claims=[];function claim(id,text,rows,limits){claims.push({id,status:'OBSERVED',text,source:r.quality.source,rowIds:rows.map(x=>x.id),limitations:limits||'Behavior is not evidence of common ownership by itself.'});}
for(const p of ['0x3ba02','0xae470','0x9ffa','0x4e2a','0xbe7','0xf1f5']){let w=lookup(p),s=w.support[0];claim('support-'+p.slice(2),`${w.wallet}: ${s.votes}/${w.historyVotes} retained votes for ${s.submitter}, ${s.roundCount} rounds; current ${s.currentVotes}.`,h.filter(x=>s.ids.includes(x.id)),'Aggregate share weights older rounds with larger budgets more heavily. Review per-round counts. Removed votes are absent.');}
const fast=family.slice(0,4).map(w=>w.wallet);const fastRows=h.filter(x=>fast.includes(x.wallet_address)&&x.round_id===d.round.id&&x.submitting_wallet===owner780);
claim('four-wallet-batch','Four wallets gave 120 combined votes to two 7802 entries within115.266seconds.',fastRows,'Already observed in original final audit. Shared call-to-action or separate supporters can produce timing clusters.');
claim('current-no-direct-self','No same-address self-votes among308 current rows.',h.filter(x=>x.round_id===d.round.id),'Distinct wallets verified to the same account require separate Farcaster/identity evidence.');
const checks=[];function check(name,condition){assert(condition,name);checks.push({name,passed:true});}
check('59 current wallets',new Set(d.votes.map(x=>x.wallet_address.toLowerCase())).size===59);
check('308 current rows and2950 votes',d.votes.length===308&&sum(d.votes)===2950);
check('1042 scoped historical rows and14717 votes',h.length===1042&&sum(h)===14717);
check('All59per-voter records reconcile current totals',r.coverage.length===59&&r.coverage.reduce((n,x)=>n+x.currentRows,0)===308&&r.coverage.reduce((n,x)=>n+x.currentVotes,0)===2950);
check('Four-wallet target batch120 and115.266seconds',fastRows.length===8&&sum(fastRows)===120&&(Math.max(...fastRows.map(x=>Date.parse(x.created_at)))-Math.min(...fastRows.map(x=>Date.parse(x.created_at))))===115266);
check('Every support breakdown reconciles wallet total',r.coverage.every(w=>w.support.reduce((n,x)=>n+x.votes,0)===w.historyVotes));
check('No direct sameaddress current selfvotes',!h.some(x=>x.round_id===d.round.id&&x.wallet_address===x.submitting_wallet));
check('No pair recurring highsimilarity >=2rounds',!r.recurrent.some(x=>x.similarRounds.length>=2));
check('All historical data uniqueness and joins pass',r.quality.allHistoryKeysUnique&&!r.quality.duplicateWalletRoundSubmission.length&&!r.quality.currentHistoryMismatch.length&&!r.quality.nullKeys&&!r.quality.invalidVotes&&!r.quality.orphanCurrent.length);
fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({checks,executedAt:new Date().toISOString(),method:'Independent recomputation of selected source-row sums and invariants; not an independent truth/source validation.'},null,2));
fs.writeFileSync(path.join(__dirname,'claim-ledger.json'),JSON.stringify(claims,null,2));
require('./make-memo.cjs');
console.log(JSON.stringify({checks:checks.length,claims:claims.length,scope:r.coverage.length}));
