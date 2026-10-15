const {fs,path,DIR,save}=require('./audit-lib.cjs');
const db=require('./database-snapshot.json'),meta=require('./chain-metadata.json'),state=require('./historical-state.json');
const txs=require('./all-transfers.json').sort((a,b)=>a.block_number-b.block_number||a.log_index-b.log_index);
const ZERO='0x0000000000000000000000000000000000000000';
const lower=a=>a.toLowerCase();
const subs=new Map(db.submissions.map(s=>[s.id,s]));
const participants=state.addresses;
const rows=state.states.snapshot.results;
function val(a,f,label='snapshot'){return state.states[label].results.find(r=>r.address===a&&r.function===f)?.value;}
const wallets=participants.map(a=>{
 const votes=db.votes.filter(v=>lower(v.wallet_address)===a);const power=Number(val(a,'getVotes'));const used=votes.reduce((n,v)=>n+v.vote_count,0);
 return {address:a,voter:!!votes.length,submitter:db.submissions.some(s=>lower(s.wallet_address)===a),snapshotVotes:power,snapshotBalance:Number(val(a,'balanceOf')),snapshotDelegate:val(a,'delegates'),cutoffVotes:Number(val(a,'getVotes','cutoff')),cutoffBalance:Number(val(a,'balanceOf','cutoff')),capacity:power>0?db.round.votes_per_wallet+power:0,used,remaining:power>0?db.round.votes_per_wallet+power-used:0,voteRows:votes.length,nonce:state.nonces.find(r=>r.ok&&r.value.address===a)?.value.nonce,otherRoundRows:db.otherVotes.filter(v=>lower(v.wallet_address)===a).length};
});
const anomalies=[];const ids=new Set(),alloc=new Set();
for(const v of db.votes){const s=subs.get(v.submission_id);const w=wallets.find(w=>w.address===lower(v.wallet_address));const key=lower(v.wallet_address)+':'+v.submission_id;if(ids.has(v.id)||alloc.has(key))anomalies.push({kind:'DUPLICATE',vote:v.id});ids.add(v.id);alloc.add(key);if(!s)anomalies.push({kind:'ORPHAN',vote:v.id});if(s&&lower(s.wallet_address)===lower(v.wallet_address))anomalies.push({kind:'DIRECT_SELF_VOTE',vote:v.id});if(s&&(s.status!=='approved'||s.deleted_at))anomalies.push({kind:'UNAVAILABLE_TARGET',vote:v.id});if(v.vote_count>db.round.max_votes_per_entry||v.vote_count<=0||!Number.isInteger(v.vote_count))anomalies.push({kind:'ENTRY_CAP',vote:v.id});if(w.capacity<=0)anomalies.push({kind:'INELIGIBLE',vote:v.id});if(new Date(v.created_at)>=new Date(db.round.voting_ends_at)||new Date(v.created_at)<new Date(db.round.voting_starts_at))anomalies.push({kind:'TIMING',vote:v.id});}
for(const w of wallets.filter(w=>w.used>w.capacity))anomalies.push({kind:'WALLET_CAPACITY',wallet:w.address,used:w.used,capacity:w.capacity});
const direct=txs.filter(t=>participants.includes(lower(t.from.hash))&&participants.includes(lower(t.to.hash))).map(t=>({tokenId:t.total.token_id,from:lower(t.from.hash),to:lower(t.to.hash),block:t.block_number,time:t.timestamp,hash:t.transaction_hash,logIndex:t.log_index}));
const histories={};for(const t of txs){const id=t.total.token_id;(histories[id]??=[]).push({tokenId:id,from:lower(t.from.hash),to:lower(t.to.hash),block:t.block_number,time:t.timestamp,hash:t.transaction_hash,logIndex:t.log_index});}
const sourceLinks=[];
for(const w of wallets){
 const tokens=Object.entries(state.snapshotOwners).filter(([id,owner])=>owner===w.address).map(([id])=>id);
 for(const id of tokens){const hist=histories[id].filter(t=>t.block<=db.round.voting_snapshot_block);const inbound=hist.at(-1);const previousParticipant=hist.slice(0,-1).reverse().find(t=>participants.includes(t.to));
  sourceLinks.push({wallet:w.address,tokenId:id,source:inbound.from,transferHash:inbound.hash,transferTime:inbound.time,hoursBeforeSnapshot:(Date.parse(meta.snapshotTimestamp)-Date.parse(inbound.time))/3600000,previousParticipant:previousParticipant?.to??null,previousParticipantTime:previousParticipant?.time??null,sourceSubmitter:db.submissions.some(s=>lower(s.wallet_address)===inbound.from),recipientVotesForSource:db.votes.filter(v=>lower(v.wallet_address)===w.address&&lower(subs.get(v.submission_id)?.wallet_address??ZERO)===inbound.from).map(v=>({id:v.id,submissionId:v.submission_id,title:subs.get(v.submission_id).title,count:v.vote_count}))});
 }
}
const sharedSources=Object.values(sourceLinks.reduce((a,l)=>{(a[l.source]??={source:l.source,wallets:[],tokens:[],recentLinks:[]}).wallets.push(l.wallet);a[l.source].tokens.push(l.tokenId);if(l.hoursBeforeSnapshot<=24*14)a[l.source].recentLinks.push(l);return a;},{})).map(s=>({...s,wallets:[...new Set(s.wallets)]})).filter(s=>s.wallets.length>1);
const tally=db.submissions.map(s=>({id:s.id,title:s.title,wallet:lower(s.wallet_address),status:s.status,deletedAt:s.deleted_at,createdAt:s.created_at,total:db.votes.filter(v=>v.submission_id===s.id).reduce((n,v)=>n+v.vote_count,0)})).sort((a,b)=>b.total-a.total||Date.parse(b.createdAt)-Date.parse(a.createdAt));
const ownershipDisagreements=[];for(const [label,ownerMap]of[['snapshot',state.snapshotOwners],['cutoff',state.cutoffOwners]])for(const r of state.states[label].results.filter(r=>r.kind==='owner'&&r.success))if(lower(r.value)!==ownerMap[r.tokenId])ownershipDisagreements.push({label,tokenId:r.tokenId,rpc:r.value,ledger:ownerMap[r.tokenId]});
const supply={snapshotLedger:Object.values(state.snapshotOwners).filter(a=>a!==ZERO).length,cutoffLedger:Object.values(state.cutoffOwners).filter(a=>a!==ZERO).length,snapshotRPC:Number(state.states.snapshot.results.find(r=>r.kind==='supply').value),cutoffRPC:Number(state.states.cutoff.results.find(r=>r.kind==='supply').value)};
const result={metadata:db.metadata,counts:{votes:db.votes.length,voters:wallets.filter(w=>w.voter).length,participants:participants.length,submissions:db.submissions.length,totalVotes:db.votes.reduce((n,v)=>n+v.vote_count,0),transferEvents:txs.length,uniqueTokens:Object.keys(histories).length},anomalies,wallets,directTransfers:direct,sourceLinks,sharedSources,tally,ownershipDisagreements,supply};
save('ledger-analysis.json',result);save('token-histories.json',histories);
console.log(JSON.stringify({counts:result.counts,anomalies,supply,ownershipDisagreements,directTransfers:direct,submitterSourceLinks:sourceLinks.filter(l=>l.sourceSubmitter),sharedSources:sharedSources.map(s=>({source:s.source,wallets:s.wallets,tokens:s.tokens,recentLinks:s.recentLinks.map(l=>({wallet:l.wallet,tokenId:l.tokenId,time:l.transferTime}))})),top:tally.slice(0,10),voters:wallets.filter(w=>w.voter)},null,2));
