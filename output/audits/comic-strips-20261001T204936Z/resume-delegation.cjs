const {utils}=require('ethers');const {CONTRACT,EXPLORER,http,pause,save}=require('./audit-lib.cjs');
(async()=>{
 const results=require('./wallet-delegation-results.json');const meta=require('./chain-metadata.json');
 let done=results.filter(r=>r.ok).length;
 for(let i=0;i<results.length;i++){
  if(results[i].ok)continue;
  const a=results[i].item;
  await pause(1800);
  try{
   const q=new URLSearchParams({module:'logs',action:'getLogs',address:CONTRACT,fromBlock:'0',toBlock:String(meta.cutoffBlock),topic0:utils.id('DelegateVotesChanged(address,uint256,uint256)'),topic1:utils.hexZeroPad(a,32),topic0_1_opr:'and',page:'1',offset:'1000'});
   const r=await http(EXPLORER+'/api?'+q);if(!Array.isArray(r.result)||r.result.length>=1000)throw new Error('Invalid or capped wallet logs');
   save('delegation-wallet-'+a+'.json',r);results[i]={ok:true,value:{wallet:a,logs:r.result}};done++;
  }catch(e){results[i]={ok:false,item:a,error:e.message};}
  save('wallet-delegation-results.json',results);
  if(done%5===0)console.log(JSON.stringify({walletsCompleted:done,total:results.length}));
 }
 const unique=new Map();for(const r of results.filter(r=>r.ok))for(const l of r.value.logs)unique.set(l.transactionHash+':'+l.logIndex,l);
 const dc=require('./delegation-DelegateChanged-page-1.json').result;
 save('all-delegation-logs.json',{'DelegateChanged(address,address,address)':dc,'DelegateVotesChanged(address,uint256,uint256)':[...unique.values()]});
 console.log(JSON.stringify({completed:done,total:results.length,voteChangeLogs:unique.size,failures:results.filter(r=>!r.ok)}));
})();
