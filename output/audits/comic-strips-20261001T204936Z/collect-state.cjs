const {utils}=require('ethers');
const {CONTRACT,EXPLORER,http,rpc,parallel,save}=require('./audit-lib.cjs');
const token=new utils.Interface(['function getVotes(address) view returns(uint256)','function balanceOf(address) view returns(uint256)','function delegates(address) view returns(address)','function totalSupply() view returns(uint256)','function ownerOf(uint256) view returns(address)']);
const multi=new utils.Interface(['function aggregate3(tuple(address target,bool allowFailure,bytes callData)[] calls) payable returns(tuple(bool success,bytes returnData)[])']);
const MULTI='0xca11bde05977b3631167028862be2a173976ca11';
(async()=>{
 const db=require('./database-snapshot.json');const meta=require('./chain-metadata.json');
 const addresses=[...new Set([...db.votes.map(v=>v.wallet_address.toLowerCase()),...db.submissions.map(s=>s.wallet_address.toLowerCase())])].sort();
 const transfers=require('./all-transfers.json').sort((a,b)=>a.block_number-b.block_number||a.log_index-b.log_index);
 const snapshotOwners=new Map(),cutoffOwners=new Map();
 for(const t of transfers){const id=t.total.token_id;cutoffOwners.set(id,t.to.hash.toLowerCase());if(t.block_number<=db.round.voting_snapshot_block)snapshotOwners.set(id,t.to.hash.toLowerCase());}
 const relevantTokens=[...new Set([...snapshotOwners,...cutoffOwners].filter(([id,owner])=>addresses.includes(owner)).map(([id])=>id).concat(['820','860','870']))];
 const keys=addresses.flatMap(a=>['getVotes','balanceOf','delegates'].map(f=>({kind:'wallet',address:a,function:f,args:[a]}))).concat([{kind:'supply',function:'totalSupply',args:[]}],relevantTokens.map(id=>({kind:'owner',tokenId:id,function:'ownerOf',args:[id]})));
 const calls=keys.map(k=>({target:CONTRACT,allowFailure:true,callData:token.encodeFunctionData(k.function,k.args)}));
 const result={addresses,relevantTokens,snapshotOwners:Object.fromEntries(snapshotOwners),cutoffOwners:Object.fromEntries(cutoffOwners),states:{}};
 for(const [label,block] of [['snapshot',db.round.voting_snapshot_block],['cutoff',meta.cutoffBlock]]){
  const raw=await rpc('eth_call',[{to:MULTI,data:multi.encodeFunctionData('aggregate3',[calls])},'0x'+block.toString(16)]);
  const decoded=multi.decodeFunctionResult('aggregate3',raw)[0];
  result.states[label]={block,results:keys.map((k,i)=>({...k,success:decoded[i].success,value:decoded[i].success?token.decodeFunctionResult(k.function,decoded[i].returnData)[0].toString():null}))};
 }
 const nonces=await parallel(addresses,async a=>({address:a,nonce:parseInt(await rpc('eth_getTransactionCount',[a,'0x'+meta.cutoffBlock.toString(16)]),16)}),3);
 result.nonces=nonces;
 save('historical-state.json',result);
 const impl=require('./contract-details.json').implementations[0].address_hash;
 save('implementation-details.json',await http(EXPLORER+'/api/v2/smart-contracts/'+impl));
 console.log(JSON.stringify({addresses:addresses.length,relevantTokens:relevantTokens.length,failedCalls:Object.fromEntries(Object.entries(result.states).map(([label,s])=>[label,s.results.filter(r=>!r.success)])),failedNonces:nonces.filter(r=>!r.ok),snapshotSupply:result.states.snapshot.results.find(r=>r.kind==='supply').value,cutoffSupply:result.states.cutoff.results.find(r=>r.kind==='supply').value}));
})().catch(e=>{console.error(JSON.stringify({error:e.message}));process.exitCode=1;});
