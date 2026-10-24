const fs=require('fs'),path=require('path'),{utils}=require('ethers');
const DIR=path.resolve('output/audits/round-propoganda-2026-10-20T13-33-16-160Z');
const CONTRACT='0x220e41499cf4d93a3629a5509410cbf9e6e0b109';
const URL='https://evm.stupidtech.net/v1/8453';
const iface=new utils.Interface(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)','event DelegateChanged(address indexed delegator,address indexed fromDelegate,address indexed toDelegate)','event DelegateVotesChanged(address indexed delegate,uint256 previousBalance,uint256 newBalance)','function getVotes(address) view returns(uint256)','function balanceOf(address) view returns(uint256)','function delegates(address) view returns(address)']);
const save=(n,v)=>fs.writeFileSync(path.join(DIR,n),JSON.stringify(v,null,2));
let seq=0;
async function rpc(method,params){for(let i=0;i<5;i++){try{let r=await fetch(URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++seq,method,params}),signal:AbortSignal.timeout(20000)});let j=await r.json();if(j.error)throw Error(j.error.message);return j.result;}catch(e){if(i===4)throw e;await new Promise(r=>setTimeout(r,750*(i+1)));}}}
const hex=n=>'0x'+n.toString(16);
(async()=>{
 const db=JSON.parse(fs.readFileSync(path.join(DIR,'database-snapshot.json')));
 const baseline=JSON.parse(fs.readFileSync('output/audits/comic-strips-20261001T204936Z/chain-metadata.json'));
 const target=Math.floor(Date.parse(db.metadata.cutoff)/1000);let lo=baseline.cutoffBlock,hi=parseInt(await rpc('eth_blockNumber',[]),16),best=lo;
 while(lo<=hi){const mid=Math.floor((lo+hi)/2),b=await rpc('eth_getBlockByNumber',[hex(mid),false]);if(parseInt(b.timestamp,16)<=target){best=mid;lo=mid+1;}else hi=mid-1;}
 const chainId=parseInt(await rpc('eth_chainId',[]),16);if(chainId!==8453)throw Error('Wrong chain');
 const meta={chainId,contract:CONTRACT,databaseCutoff:db.metadata.cutoff,cutoffBlock:best,snapshotBlock:db.round.voting_snapshot_block,rpc:URL,baseline:'../comic-strips-20261001T204936Z',baselineCutoffBlock:baseline.cutoffBlock,collectedAt:new Date().toISOString()};save('chain-metadata.json',meta);
 const ranges=[];for(let a=baseline.cutoffBlock+1;a<=best;a+=50000)ranges.push([a,Math.min(a+49999,best)]);
 const out=new Array(ranges.length);let next=0,done=0;
 await Promise.all(Array.from({length:3},async()=>{while(next<ranges.length){const i=next++,[a,b]=ranges[i];try{const logs=await rpc('eth_getLogs',[{address:CONTRACT,fromBlock:hex(a),toBlock:hex(b),topics:[[iface.getEventTopic('Transfer'),iface.getEventTopic('DelegateChanged'),iface.getEventTopic('DelegateVotesChanged')]]}]);out[i]={fromBlock:a,toBlock:b,logs};}catch(e){out[i]={fromBlock:a,toBlock:b,error:e.message};}save('rpc-log-ranges.json',out.filter(Boolean));if(++done%20===0)console.log(JSON.stringify({eventRanges:done,total:ranges.length}));}}));
 const events=out.filter(r=>r.logs).flatMap(r=>r.logs).map(l=>{const d=iface.parseLog(l);return {event:d.name,block:parseInt(l.blockNumber,16),logIndex:parseInt(l.logIndex,16),tx:l.transactionHash,args:d.args.map(x=>x.toString()),raw:l};}).sort((a,b)=>a.block-b.block||a.logIndex-b.logIndex);save('rpc-events.json',events);
 const addresses=[...new Set([...db.votes,...db.submissions].map(x=>x.wallet_address.toLowerCase()))];
 const multi=new utils.Interface(['function aggregate3(tuple(address target,bool allowFailure,bytes callData)[] calls) payable returns(tuple(bool success,bytes returnData)[])']);
 const keys=addresses.flatMap(a=>['getVotes','balanceOf','delegates'].map(f=>({address:a,fn:f})));
 const states={};for(const [label,block]of [['snapshot',db.round.voting_snapshot_block],['cutoff',best]]){try{const calls=keys.map(k=>({target:CONTRACT,allowFailure:true,callData:iface.encodeFunctionData(k.fn,[k.address])}));const raw=await rpc('eth_call',[{to:'0xca11bde05977b3631167028862be2a173976ca11',data:multi.encodeFunctionData('aggregate3',[calls])},hex(block)]);const results=multi.decodeFunctionResult('aggregate3',raw)[0];states[label]={block,results:keys.map((k,i)=>({...k,success:results[i].success,value:results[i].success?iface.decodeFunctionResult(k.fn,results[i].returnData)[0].toString():null}))};}catch(e){states[label]={block,error:e.message};}save('historical-state.json',states);}
 console.log(JSON.stringify({completed:true,meta,ranges:out.length,failedRanges:out.filter(x=>x.error),events:events.length,stateErrors:Object.entries(states).filter(([k,v])=>v.error)}));
})().catch(e=>{console.error(JSON.stringify({error:e.message}));process.exitCode=1});

