const {utils}=require('ethers');
const {CONTRACT,EXPLORER,http,rpc,parallel,save,fs,path,DIR}=require('./audit-lib.cjs');
(async()=>{
 const db=require('./database-snapshot.json');
 const meta=require('./chain-metadata.json');
 const target=Math.floor(new Date(db.metadata.cutoff).getTime()/1000);
 let lo=meta.cutoffBlock,hi=parseInt(await rpc('eth_blockNumber',[]),16),best=lo;
 while(lo<=hi){const m=Math.floor((lo+hi)/2);const b=await rpc('eth_getBlockByNumber',['0x'+m.toString(16),false]);if(parseInt(b.timestamp,16)<=target){best=m;lo=m+1;}else hi=m-1;}
 const cutoff=await rpc('eth_getBlockByNumber',['0x'+best.toString(16),false]);
 meta.cutoffBlock=best;meta.cutoffHash=cutoff.hash;meta.cutoffTimestamp=new Date(parseInt(cutoff.timestamp,16)*1000).toISOString();meta.databaseCutoff=db.metadata.cutoff;save('chain-metadata.json',meta);
 const transfers=require('./all-transfers.json');
 const first=await http(EXPLORER+'/api/v2/tokens/'+CONTRACT+'/transfers');
 const keys=new Set(transfers.map(t=>t.transaction_hash+':'+t.log_index));
 for(const t of first.items){const key=t.transaction_hash+':'+t.log_index;if(t.block_number<=best&&!keys.has(key)){transfers.push(t);keys.add(key);}}
 transfers.sort((a,b)=>a.block_number-b.block_number||a.log_index-b.log_index);save('all-transfers.json',transfers);
 const dc=await http(EXPLORER+'/api?'+new URLSearchParams({module:'logs',action:'getLogs',address:CONTRACT,fromBlock:'0',toBlock:String(best),topic0:utils.id('DelegateChanged(address,address,address)'),page:'1',offset:'1000'}));
 if(!Array.isArray(dc.result))throw new Error('DelegateChanged query failed');
 save('delegation-DelegateChanged-page-1.json',dc);
 const participants=[...new Set([...db.votes.map(v=>v.wallet_address.toLowerCase()),...db.submissions.map(s=>s.wallet_address.toLowerCase())])];
 const results=await parallel(participants,async a=>{
  const q=new URLSearchParams({module:'logs',action:'getLogs',address:CONTRACT,fromBlock:'0',toBlock:String(best),topic0:utils.id('DelegateVotesChanged(address,uint256,uint256)'),topic1:utils.hexZeroPad(a,32),topic0_1_opr:'and',page:'1',offset:'1000'});
  const r=await http(EXPLORER+'/api?'+q);
  if(!Array.isArray(r.result))throw new Error('Wallet delegation query failed');
  if(r.result.length>=1000)throw new Error('Wallet delegation query requires pagination');
  save('delegation-wallet-'+a+'.json',r);
  return {wallet:a,logs:r.result};
 },3);
 save('wallet-delegation-results.json',results);
 const unique=new Map();for(const r of results.filter(r=>r.ok))for(const l of r.value.logs)unique.set(l.transactionHash+':'+l.logIndex,l);
 save('all-delegation-logs.json',{'DelegateChanged(address,address,address)':dc.result,'DelegateVotesChanged(address,uint256,uint256)':[...unique.values()]});
 console.log(JSON.stringify({cutoffBlock:best,transfers:transfers.length,participantCount:participants.length,delegateChanges:dc.result.length,voteChangeLogs:unique.size,failedWallets:results.filter(r=>!r.ok)}));
})().catch(e=>{console.error(JSON.stringify({error:e.message}));process.exitCode=1;});
