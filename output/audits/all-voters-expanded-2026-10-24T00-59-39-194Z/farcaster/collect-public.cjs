const fs=require('fs'),path=require('path'),{providers}=require('ethers');
const D=__dirname,read=f=>JSON.parse(fs.readFileSync(f)),write=(f,v)=>fs.writeFileSync(path.join(D,f),JSON.stringify(v,null,2));
const db=read(path.join(D,'../../round-propoganda-2026-10-23T21-12-26-163Z/database-snapshot.json'));
const oldEns=read(path.join(D,'../../seven-wallet-ownership-2026-10-24T00-43-36-683Z/ens-reverse.json'));
const voters=[...new Set(db.votes.map(v=>v.wallet_address.toLowerCase()))],submitters=[...new Set(db.submissions.filter(s=>!s.deleted_at&&s.status==='approved').map(s=>s.wallet_address.toLowerCase()))];
const addresses=[...new Set([...voters,...submitters,'0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d','0xcd295a33541d5aeb259c05ad51ef12b5e7fa30c1'])];
write('scope.json',{voters,submitters,addresses});
async function pool(items,n,fn){let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<items.length)await fn(items[i++]);}));}
async function get(url,file){let row;try{const r=await fetch(url,{signal:AbortSignal.timeout(12000)}),text=await r.text();let data;try{data=JSON.parse(text)}catch{data={text:text.slice(0,5000)}}row={url,status:r.status,retrievedAt:new Date().toISOString(),data};}catch(e){row={url,retrievedAt:new Date().toISOString(),error:e.message};}write(file,row);return row;}
(async()=>{
const ens=oldEns.filter(e=>addresses.includes(e.address));await pool(addresses.filter(a=>!ens.some(e=>e.address===a)),3,async address=>{const p=new providers.StaticJsonRpcProvider({url:'https://ethereum.publicnode.com',timeout:8000},{chainId:1,name:'homestead'});let row;try{if(await p.send('eth_chainId',[])!=='0x1')throw Error('wrong chain');const name=await p.lookupAddress(address);row={address,name,status:name?'resolved':'no forward-confirmed reverse name',retrievedAt:new Date().toISOString(),provider:'https://ethereum.publicnode.com'};}catch(e){row={address,status:'unknown',error:e.message.slice(0,180)}}ens.push(row);write('ens-reverse-all.json',ens);});
const names=new Map();function add(name,reason,address){if(!name)return;name=name.toLowerCase();if(!names.has(name))names.set(name,[]);names.get(name).push({reason,address});}
ens.forEach(e=>e.name&&add(e.name,'forward-confirmed ENS',e.address));
for(const p of db.profiles){if(p.farcaster){try{add(new URL(p.farcaster).pathname.split('/')[1],'self supplied profile URL',p.wallet_address.toLowerCase())}catch{}}}
for(const s of [...db.submissions,...db.submitter_submissions]){if(s.url){try{const u=new URL(s.url);if(['farcaster.xyz','warpcast.com'].includes(u.hostname))add(u.pathname.split('/')[1],'submission URL',s.wallet_address.toLowerCase());}catch{}}}
write('username-candidates.json',Object.fromEntries(names));
await pool([...names.keys()],3,async n=>{const r=await get('https://api.farcaster.xyz/v2/user-by-username?username='+encodeURIComponent(n),'profile-'+encodeURIComponent(n)+'.json');const u=r.data?.result?.user;if(u?.fid){await get('https://api.farcaster.xyz/v2/verifications?fid='+u.fid,'verifications-'+u.fid+'.json');console.log(JSON.stringify({name:n,fid:u.fid,addresses:r.data.result.extras?.ethWallets}));}else console.log(JSON.stringify({name:n,status:r.status,error:r.error||r.data?.errors}));});
await get('https://api.farcaster.xyz/v2/user-by-verification?address='+addresses[0],'address-lookup-access.json');
console.log('DONE '+addresses.length+' addresses '+names.size+' candidate usernames');
})().catch(e=>{console.error(e);process.exit(1)});

