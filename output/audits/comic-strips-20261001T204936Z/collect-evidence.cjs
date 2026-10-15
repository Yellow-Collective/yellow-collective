const {utils}=require('ethers');const {CONTRACT,EXPLORER,http,rpc,parallel,save,pause}=require('./audit-lib.cjs');
const event=new utils.Interface(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)','event DelegateChanged(address indexed delegator,address indexed fromDelegate,address indexed toDelegate)','event DelegateVotesChanged(address indexed delegate,uint256 previousBalance,uint256 newBalance)']);
const tok=new utils.Interface(['function getVotes(address) view returns(uint256)','function balanceOf(address) view returns(uint256)','function delegates(address) view returns(address)']);
const multi=new utils.Interface(['function aggregate3(tuple(address target,bool allowFailure,bytes callData)[] calls) payable returns(tuple(bool success,bytes returnData)[])']);
const MULTI='0xca11bde05977b3631167028862be2a173976ca11';
(async()=>{
 const db=require('./database-snapshot.json'),a=require('./ledger-analysis.json'),h=require('./token-histories.json'),meta=require('./chain-metadata.json');
 const dc=require('./delegation-DelegateChanged-page-1.json').result.map(l=>{const p=event.parseLog({topics:l.topics.filter(Boolean),data:l.data});return {kind:p.name,delegator:p.args.delegator.toLowerCase(),from:p.args.fromDelegate.toLowerCase(),to:p.args.toDelegate.toLowerCase(),block:parseInt(l.blockNumber,16),time:new Date(parseInt(l.timeStamp,16)*1000).toISOString(),hash:l.transactionHash,logIndex:parseInt(l.logIndex,16)};});
 save('decoded-delegation-changes.json',dc);
 const externalDelegators=[...new Set(dc.filter(d=>a.wallets.some(w=>w.address===d.to)).map(d=>d.delegator))];
 const latest=new Map();for(const d of dc.filter(d=>d.block<=db.round.voting_snapshot_block))latest.set(d.delegator,d.to);
 const maps={};for(const owner of externalDelegators)maps[owner]={delegateAtSnapshot:latest.get(owner)||owner,tokensAtSnapshot:Object.entries(require('./historical-state.json').snapshotOwners).filter(([id,o])=>o===owner).map(([id])=>id)};
 save('external-delegators.json',maps);
 const relevantDc=dc.filter(d=>(a.wallets.some(w=>w.address===d.to)||a.wallets.some(w=>w.address===d.from))&&Date.parse(d.time)>=Date.parse('2026-09-01T00:00:00Z'));
 const relevantTransfers=a.directTransfers.concat(['820','860','870','254','355','955','959'].flatMap(id=>h[id]||[])).concat(externalDelegators.flatMap(owner=>Object.values(h).flat().filter(t=>t.from===owner||t.to===owner)));
 const hashes=[...new Set([...relevantTransfers,...relevantDc].map(t=>t.hash))];
 const receipts=await parallel(hashes,async hash=>{
  const [r,t]=await Promise.all([rpc('eth_getTransactionReceipt',[hash]),rpc('eth_getTransactionByHash',[hash])]);
  if(!r||!t||r.status!=='0x1')throw new Error('Missing/failed receipt');
  const decoded=r.logs.filter(l=>l.address.toLowerCase()===CONTRACT).map(l=>{try{const p=event.parseLog(l);const args={};for(const [k,v]of Object.entries(p.args))if(!/^\d+$/.test(k))args[k]=v.toString();return {event:p.name,args,logIndex:parseInt(l.logIndex,16),block:parseInt(l.blockNumber,16)};}catch{return {event:'OTHER',topics:l.topics,logIndex:parseInt(l.logIndex,16)};}});
  return {hash,transaction:{from:t.from,to:t.to,value:t.value,input:t.input,block:parseInt(t.blockNumber,16)},receipt:r,decoded};
 },3);
 save('verified-receipts.json',receipts);
 const deltas=await parallel([...a.directTransfers,...relevantDc],async e=>{
  const addrs=[...new Set([e.from,e.to,...(e.delegator?[e.delegator]:[])])];const keys=addrs.flatMap(address=>['getVotes','balanceOf','delegates'].map(fn=>({address,fn})));
  const calls=keys.map(k=>({target:CONTRACT,allowFailure:true,callData:tok.encodeFunctionData(k.fn,[k.address])}));
  const result={event:e,states:{}};
  for(const [label,block]of[['before',e.block-1],['after',e.block]]){
   const raw=await rpc('eth_call',[{to:MULTI,data:multi.encodeFunctionData('aggregate3',[calls])},'0x'+block.toString(16)]);const out=multi.decodeFunctionResult('aggregate3',raw)[0];
   result.states[label]=keys.map((k,i)=>({...k,value:out[i].success?tok.decodeFunctionResult(k.fn,out[i].returnData)[0].toString():null,success:out[i].success}));
  }return result;
 },3);
 save('historical-event-deltas.json',deltas);
 const actorList=[...new Set(['0x9ab51fd89f163d07127df192b615356d53b406f6','0x79ed59c8c92ff3f3384c2c43e1088e6b56e8af6e','0xb89743f3b06d66ed5d7e3bbdf8312f6856de6c6b','0x1bae19af613bd5db94baf043d5817e16a53a4c33','0x3b6a7fdeabd4405991bfb1c80e61e1056da20c9a','0xcba18cb7e7c043b378e21607fa104f1767442348','0xe212d2ca76e29c0d3a8ebfb665abf4679535df27','0xac1a6f43425efdd808748a6eb992fa047e90776e','0xf7aef946d3f2e58a3685166ace1fc3db76d614de','0xf1f5d35c46fd62fdd9150c39acc4a1b6a8327ae4','0x28e8292c6b21288140c5b4f16b28cede42e8098c',...externalDelegators])];
 const activities=[];
 for(const address of actorList){
  try{await pause(500);const tx=await http(EXPLORER+'/api/v2/addresses/'+address+'/transactions');const inbound=await http(EXPLORER+'/api/v2/addresses/'+address+'/transactions?filter=to');
   activities.push({address,transactions:tx.items.map(t=>({hash:t.hash,from:t.from.hash.toLowerCase(),to:t.to?.hash.toLowerCase(),timestamp:t.timestamp,value:t.value,method:t.method})),hasMoreTransactions:!!tx.next_page_params,inbound:inbound.items.map(t=>({hash:t.hash,from:t.from.hash.toLowerCase(),to:t.to?.hash.toLowerCase(),timestamp:t.timestamp,value:t.value,method:t.method})),hasMoreInbound:!!inbound.next_page_params});
  }catch(e){activities.push({address,error:e.message});}save('wallet-activity.json',activities);
 }
 const sources=['0x00ec9615ab4f45cbeb66b5fa36bced3d79f38bb3','0x0aa23a7e112889c965010558803813710becf263'];
 save('common-source-contracts.json',await parallel(sources,async address=>({address,codeAtSnapshot:await rpc('eth_getCode',[address,'0x'+db.round.voting_snapshot_block.toString(16)]),metadata:await http(EXPLORER+'/api/v2/addresses/'+address)}),2));
 console.log(JSON.stringify({receiptCount:receipts.length,failedReceipts:receipts.filter(r=>!r.ok),eventDeltas:deltas.length,failedDeltas:deltas.filter(r=>!r.ok),actorCount:actorList.length,failedActivities:activities.filter(a=>a.error),relevantDelegations:relevantDc,externalDelegators:maps}));
})().catch(e=>{console.error(JSON.stringify({error:e.message}));process.exitCode=1;});
