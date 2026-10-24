const {utils}=require('ethers');
const {CONTRACT,EXPLORER,http,rpc,save,fs,path,DIR}=require('./audit-lib.cjs');
(async()=>{
 const cutoffHex=await rpc('eth_blockNumber',[]);
 const cutoffBlock=parseInt(cutoffHex,16);
 const cutoff=await rpc('eth_getBlockByNumber',[cutoffHex,false]);

 const chain={chainId:parseInt(await rpc('eth_chainId',[]),16),contract:CONTRACT,cutoffBlock,cutoffHash:cutoff.hash,cutoffTimestamp:new Date(parseInt(cutoff.timestamp,16)*1000).toISOString(),collectedAt:new Date().toISOString()};
 save('chain-metadata.json',chain);
 const details=await http(EXPLORER+'/api/v2/smart-contracts/'+CONTRACT);
 save('contract-details.json',details);
 console.log(JSON.stringify({chain,events:(details.abi||[]).filter(x=>x.type==='event').map(x=>x.name)}));
 let next={};let all=[];let page=0;const seen=new Set();
 do{
  const qs=new URLSearchParams(next).toString();
  const r=await http(EXPLORER+'/api/v2/tokens/'+CONTRACT+'/transfers'+(qs?'?'+qs:''));
  save('transfer-page-'+(++page)+'.json',r);
  all.push(...r.items.filter(t=>t.block_number<=cutoffBlock));
  next=r.next_page_params;
  if(next){const k=JSON.stringify(next);if(seen.has(k))throw new Error('Repeated transfer cursor');seen.add(k);}
  if(page%10===0)console.log(JSON.stringify({transferPages:page,transfers:all.length}));
  if(page>150)throw new Error('Transfer page limit');
 }while(next);
 save('all-transfers.json',all);
 const delegation={};
 for(const signature of ['DelegateChanged(address,address,address)','DelegateVotesChanged(address,uint256,uint256)']){
  const topic=utils.id(signature);let entries=[];let p=1;
  for(;;){
   const q=new URLSearchParams({module:'logs',action:'getLogs',address:CONTRACT,fromBlock:'0',toBlock:String(cutoffBlock),topic0:topic,page:String(p),offset:'1000'});
   const r=await http(EXPLORER+'/api?'+q);
   save('delegation-'+signature.split('(')[0]+'-page-'+p+'.json',r);
   if(r.status!=='1'&&r.message!=='No logs found')throw new Error('Explorer logs failed '+r.message);
   const items=Array.isArray(r.result)?r.result:[];
   if(items.length&&entries.some(e=>e.transactionHash===items[0].transactionHash&&e.logIndex===items[0].logIndex))throw new Error('Repeated delegation page');
   entries.push(...items);
   if(items.length<1000)break;
   if(++p>30)throw new Error('Delegation page limit');
  }
  delegation[signature]=entries;
  console.log(JSON.stringify({event:signature,logs:entries.length}));
 }
 save('all-delegation-logs.json',delegation);
 console.log(JSON.stringify({completed:true,transferPages:page,transfers:all.length,delegationCounts:Object.fromEntries(Object.entries(delegation).map(([k,v])=>[k,v.length]))}));
})().catch(e=>{console.error(JSON.stringify({status:'COLLECTION_FAILED',error:e.message}));process.exitCode=1;});

