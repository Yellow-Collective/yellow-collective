const fs=require('fs'),path=require('path');
const {decodeEventLog,formatEther,toEventSelector}=require('viem');
const D=__dirname,rd=n=>JSON.parse(fs.readFileSync(path.join(D,n),'utf8')),wr=(n,x)=>fs.writeFileSync(path.join(D,n),JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2));
const abi=JSON.parse(rd('auction-implementation-abi.json').result),history=rd('nft-histories.json'),auction='0x0aa23a7e112889c965010558803813710becf263';
let id=0;
async function rpc(method,params){let errors=[];for(const url of ['https://evm.stupidtech.net/v1/8453','https://mainnet.base.org']){try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(25000)});const j=await r.json();if(j.error)throw Error(JSON.stringify(j.error));return {url,result:j.result};}catch(e){errors.push(url+': '+e.message);}}throw Error(errors.join('; '));}
(async()=>{const output=[];for(const h of history.filter(x=>x.from!=='0x0000000000000000000000000000000000000000')){const receipt=rd('receipt-'+h.tx+'.json').result;const log=receipt.logs.find(l=>Number(l.logIndex)===h.logIndex);if(!log||log.topics[3]!==('0x'+BigInt(h.token).toString(16).padStart(64,'0')))throw Error('NFT mismatch '+h.tx);const normalFile=fs.readdirSync(D).filter(n=>n.startsWith('normal-')&&n.includes('-page-'));let tx;for(const n of normalFile){tx=rd(n).result.result.find?.(t=>t.hash===h.tx);if(tx)break;}
const record={...h,receivedAt:new Date(Number(BigInt(log.blockTimestamp))*1000).toISOString(),receiptFrom:receipt.from,receiptTo:receipt.to,transaction:tx||null,purchase:null};
if(h.from===auction){const settled=receipt.logs.filter(l=>l.address.toLowerCase()===auction).map(l=>{try{return decodeEventLog({abi,data:l.data,topics:l.topics});}catch{return null;}}).find(l=>l?.eventName==='AuctionSettled'&&String(l.args.tokenId)===h.token);
if(!settled)throw Error('Missing settled '+h.token);
record.purchase={winner:settled.args.winner.toLowerCase(),amountWei:String(settled.args.amount),amountEth:formatEther(settled.args.amount)};
const mint=history.find(x=>x.token===h.token&&x.from==='0x0000000000000000000000000000000000000000');
const logs={url:'official Etherscan MCP, Base 8453',result:rd('auction-'+h.token+'-all-logs.json').result};
const bids=logs.result.map(l=>{let decoded;try{decoded=decodeEventLog({abi,data:l.data,topics:l.topics});}catch{return null;}return {...decoded,tx:l.transactionHash,block:Number(l.blockNumber),logIndex:Number(l.logIndex)};}).filter(x=>x&&x.eventName==='AuctionBid'&&String(x.args.tokenId)===h.token);
record.purchase.bidLogProvider=logs.url;record.purchase.bids=bids;
const winning=bids.at(-1);if(!winning||winning.args.bidder.toLowerCase()!==record.purchase.winner||String(winning.args.amount)!==record.purchase.amountWei)throw Error('Bid mismatch '+h.token);
let bidTx;for(const n of normalFile){bidTx=rd(n).result.result.find?.(t=>t.hash===winning.tx);if(bidTx)break;}if(!bidTx)throw Error('Missing bid transaction '+winning.tx);const bidLog=logs.result.find(l=>l.transactionHash===winning.tx&&Number(l.logIndex)===winning.logIndex);
record.purchase.winningBid={...winning,transaction:bidTx,time:new Date(Number(BigInt(bidLog.timeStamp))*1000).toISOString(),provider:logs.url};}
output.push(record);wr('nft-acquisitions.json',output);console.log(JSON.stringify({token:h.token,to:h.to,time:record.receivedAt,purchase:record.purchase&&{amountEth:record.purchase.amountEth,bidder:record.purchase.winner,bidTime:record.purchase.winningBid.time,bidSender:record.purchase.winningBid.transaction.from}}));}
// Historical AuctionBid and AuctionSettled topics match the verified ABI; no implementation continuity is assumed.
})().catch(e=>{console.error(e);process.exit(1);});

