const fs=require('fs');const path=require('path');
const DIR=__dirname;
const CONTRACT='0x220e41499cf4d93a3629a5509410cbf9e6e0b109';
const RPC='https://mainnet.base.org';
const EXPLORER='https://base.blockscout.com';
const failures=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const save=(name,data)=>fs.writeFileSync(path.join(DIR,name),JSON.stringify(data,null,2));
async function http(url,options={}){for(let i=0;i<4;i++){try{const r=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('HTTP_'+r.status);return await r.json();}catch(e){if(i===3){failures.push({url,status:e.name,message:e.message.slice(0,160)});save('network-failures.json',failures);throw e;}await pause(750*(i+1));}}}
let rid=0;
async function rpc(method,params){const r=await http(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++rid,method,params})});if(r.error)throw new Error(r.error.message);return r.result;}
async function parallel(items,fn,n=3){const result=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(next<items.length){const i=next++;try{result[i]={ok:true,value:await fn(items[i],i)};}catch(e){result[i]={ok:false,error:e.message.slice(0,180),item:items[i]};}}}));return result;}
module.exports={fs,path,DIR,CONTRACT,RPC,EXPLORER,http,rpc,parallel,pause,save,failures};
