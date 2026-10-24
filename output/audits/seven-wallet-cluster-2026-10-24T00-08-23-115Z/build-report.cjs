const fs=require('fs'),path=require('path'),crypto=require('crypto'),{formatEther,decodeEventLog}=require('viem');
const D=__dirname,rd=n=>JSON.parse(fs.readFileSync(path.join(D,n),'utf8')),wr=(n,x)=>fs.writeFileSync(path.join(D,n),typeof x==='string'?x:JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2));
const c=rd('connections.json'),s=c.scope,nfts=rd('nft-acquisitions.json'),a=JSON.parse(fs.readFileSync(path.join(s.sourceAudit,'analysis.json'))),db=JSON.parse(fs.readFileSync(path.join(s.sourceAudit,'database-snapshot.json')));
const H='0xbe7bfad8952ae92abb8779aa4d6826839e82fa3d',I='0xcd295a33541d5aeb259c05ad51ef12b5e7fa30c1',relay='0xa5f565650890fba1824ee0f21ebbbf660a179934',across='0x09aea4b2242abc8bb4bb78d537a67a245a7bec64',auction='0x0aa23a7e112889c965010558803813710becf263',treasury='0x00ec9615ab4f45cbeb66b5fa36bced3d79f38bb3';
const ids=Object.fromEntries(s.wallets.map((w,i)=>[w,String.fromCharCode(65+i)]));ids[H]='H';ids[I]='I';
const short=w=>w.slice(0,6)+'…'+w.slice(-4),label=w=>(ids[w]?ids[w]+' · ':'')+short(w),wallet=w=>'['+label(w)+'](https://basescan.org/address/'+w+')',tx=(h,title='transaction',chain='base')=>'['+title+'](https://'+(chain==='base'?'basescan.org':'etherscan.io')+'/tx/'+h+')',date=t=>t.replace('T',' ').replace('.000Z',' UTC').replace('Z',' UTC'),eth=x=>formatEther(BigInt(x)),fmt=x=>Number(x).toFixed(6).replace(/0+$/,'').replace(/\.$/,'');
const states=s.wallets.map(w=>a.walletStates.find(v=>v.wallet===w)),normalSum=c.pairsInsideGroup.reduce((n,p)=>n+p.normal,0),internalSum=c.pairsInsideGroup.reduce((n,p)=>n+p.internal,0),ballotCount=states.reduce((n,w)=>n+w.ballots.length,0);
const expanded=rd('expanded-normal-cd295-page-1.json').result.result,expandedEdges=expanded.filter(t=>t.isError==='0'&&BigInt(t.value)>0n).map(t=>({kind:'normal',from:t.from,to:t.to,valueWei:t.value,hash:t.hash,traceId:null,block:Number(t.blockNumber),time:new Date(Number(t.timeStamp)*1000).toISOString()}));
const dedup=new Map;for(const e of [...c.edges,...expandedEdges])dedup.set([e.kind,e.hash,e.traceId,e.from,e.to,e.valueWei].join(':'),e);
const selected=[...dedup.values()].filter(e=>[e.from,e.to].every(w=>s.wallets.includes(w)||w===H||w===I)).sort((x,y)=>x.block-y.block);
const excluded=[['0x0000000000000000000000000000000000000000','mint/burn'],[auction,'Collective Nouns auction'],[treasury,'DAO source of winner NFT 780'],[relay,'verified RelayReceiver'],[across,'verified Across OP_SpokePool proxy']];
const skip=new Set(excluded.map(x=>x[0])),adj=new Map;function add(x,y){if(skip.has(x)||skip.has(y)||x===y)return;for(const [q,r]of [[x,y],[y,x]]){if(!adj.has(q))adj.set(q,new Set);adj.get(q).add(r);}}
for(const e of [...dedup.values(),...a.transfers])add(e.from,e.to);
function bfs(from,to,maxSteps=4){const q=[[from]],seen=new Set([from]);while(q.length){const p=q.shift(),x=p.at(-1);if(x===to)return p;if(p.length>maxSteps)continue;for(const n of adj.get(x)||[])if(!seen.has(n)){seen.add(n);q.push([...p,n]);}}return null;}
const pathsToWinner=s.wallets.map(w=>({wallet:w,maxSteps:4,path:bfs(w,s.firstPlaceSubmitter)}));
const abi=JSON.parse(rd('across-implementation-source.json').result[0].ABI);
const bridges=['A','B'].map(k=>{const receipt=rd('first-funding-'+k+'-receipt.json').result,w=s.wallets[k==='A'?0:1],fill=receipt.logs.map(l=>{try{return decodeEventLog({abi,data:l.data,topics:l.topics});}catch{return null;}}).find(z=>z?.eventName==='FilledV3Relay'&&z.args.recipient.toLowerCase()===w);return {wallet:w,baseReceipt:receipt.transactionHash,fill,ethereumDeposit:rd('ethereum-origin-'+k+'-deposit.json').result.result[0],ethereumTransaction:rd('ethereum-origin-'+k+'-transaction.json').result,sharedDepositorClassification:rd('ethereum-common-depositor-source.json').result[0].ContractName};});
const reimbursement=c.edges.find(e=>e.hash==='0x990cc7082a705330b2823b40b0b2c031131a7afb2a2c341d63b6832e94761e68'),fence=String.fromCharCode(96).repeat(3);
const data={scope:s,identifiers:ids,observed:{nativeWithinSeven:{normal:normalSum,internal:internalSum,pairs:c.pairsInsideGroup.length},walletStates:states,nftAcquisitions:nfts,intermediaries:{H,I},bridges,reimbursement312:reimbursement,pathsToWinner,excludedInfrastructure:excluded},inference:{ownership:'Unknown. Coordination or some common control is plausible; A/B are financial hubs, not identified people.',token312:'Likely purchase or reimbursement at auction cost: 0.033 ETH payment followed 44m18s later by NFT delivery.',winner:'No verified personal control link to the first-place submitter.'},coverage:{normal:'Provider-reported complete histories for seven, H, I and winner through Base 53000299.',internal:'A/B/C/H capped at 4000 ascending records each; D/E/F/G/I/winner reached a short final page.',crosschain:'Two targeted Ethereum deposits/origin transactions; no full Ethereum history.',graph:'Saved native ETH edges plus full Collective Nouns transfer ledger; undirected BFS up to four steps excluding named infrastructure, not an exhaustive global search.'}};
wr('report-data.json',data);
const csv=rows=>rows.map(row=>row.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n';
wr('native-transfer-ledger.csv',csv([['time_utc','from_id','from','to_id','to','eth','kind','hash','trace_id','basescan'],...selected.map(e=>[e.time,ids[e.from],e.from,ids[e.to],e.to,eth(e.valueWei),e.kind,e.hash,e.traceId,'https://basescan.org/tx/'+e.hash])]));
wr('nft-timeline.csv',csv([['token','received_utc','from','to','auction_price_eth','winning_bid_utc','winning_bid_hash','receipt_hash','basescan'],...nfts.map(n=>[n.token,n.receivedAt,n.from,n.to,n.purchase?.amountEth,n.purchase?.winningBid.time,n.purchase?.winningBid.tx,n.tx,'https://basescan.org/tx/'+n.tx])]));
wr('wallet-votes.csv',csv([['wallet_id','wallet','title','votes','created_at','allocation_id'],...states.flatMap(w=>w.ballots.map(b=>[ids[w.wallet],w.wallet,b.title,b.votes,b.time,b.id]))]));
const acquisitions=w=>nfts.filter(n=>n.to===w).map(n=>n.purchase?'#'+n.token+' — '+n.receivedAt.slice(0,10)+' · '+n.purchase.amountEth+' ETH':'#'+n.token+' — '+n.receivedAt.slice(0,10)+' · from '+ids[n.from]).join('<br>');
const firstDescriptions=['Across bridge; own Ethereum address','Across bridge; own Ethereum address','B sent 0.002 ETH','B sent 0.000185 ETH','A sent 0.00136 ETH','I sent 0.0015 ETH; I funded by A/B','A sent 0.0003 ETH'];
const main=[
'# Seven-wallet investigation — Propaganda round','',
'**Assessment:** These seven form a financially connected group. Coordination or some shared control is plausible. **Their human owner is unknown. Self-voting for the first-place submitter has not been verified.**','',
'Final production snapshot: **23 October 2026, 21:12 UTC**. All dates below are UTC.','',
'## What stands out','',
'- **194 direct ETH transactions + 1 internal ETH transfer** connect 14 pairs within the seven. A and B are the main hubs; they exchanged ETH in 79 direct transactions.',
'- A supplied E with **NFT 399**. Outside wallet H supplied C and F with **NFTs 312 and 313**.',
'- C paid H **0.033 ETH**, matching NFT 312’s auction price, **44 minutes before receiving it**. This is consistent with a purchase or reimbursement at cost.',
'- Outside wallet I received ETH from A/B, then supplied F’s first observed Base funding.',
'- All seven cast their first recorded Yellow Rounds ballots over **about 34 minutes**: **15 votes each / 105 total** for **Support Yellow Artists**. Their 360 total votes also supported six other entries.',
'- **NFT acquisitions date to 2024–2025.** These are older Base wallets entering Rounds voting for the first time in the saved history.','',
'## The seven wallets','',
'Every wallet below has **Owner unknown**. Auction prices exclude gas. A/B are investigation anchors, not verified owners of the other addresses.','',
'| ID / BaseScan | Yellow profile | NFT acquisition history | NFTs at voting snapshot | Votes to first place |',
'|---|---|---|---:|---:|',
...s.wallets.map((w,i)=>'| '+wallet(w)+' | [Profile](https://www.yellowcollective.art/profile/'+w+') | '+acquisitions(w)+(i===0?'<br>Sent #399 to E on 2025-01-02':'')+' | '+states[i].balanceOf+' | 15 |'),'',
'## The useful paths','',fence+'mermaid','flowchart LR',
'  A["A · dc37"] <-->|"79 ETH transactions"| B["B · 0b81"]',
'  A -->|"first funding + NFT 399"| E["E · 0756"]',
'  A -->|"first funding"| G["G · 3147"]',
'  B -->|"first funding"| C["C · eb8a"]',
'  B -->|"first funding"| D["D · 0816"]',
'  B -->|"ETH"| H["H · be7 · outside seven"]',
'  H -->|"NFT 312"| C',
'  H -->|"NFT 313"| F["F · b15a"]',
'  A -->|"ETH"| I["I · cd295 · outside seven"]',
'  B -->|"ETH"| I',
'  I -->|"first funding"| F',fence,'',
'Outside intermediaries: '+wallet(H)+' (NFT supplier) and '+wallet(I)+' (funding intermediary). Their owners are unknown.','',
'Arrows show transactions/asset history. They do not establish who controls an address. The appendix links each step.','',
'## Connection to first place','',
'**Support Yellow Artists** received 105 votes from the seven and finished first with 318 votes. Submitter: '+wallet(s.firstPlaceSubmitter)+'.','',
'No direct ETH/NFT/delegation link to the submitter was found in the collected evidence. A bounded search through four steps found no path after excluding identified infrastructure. The shared two-step ETH counterparty was **RelayReceiver**, a service contract.','',
'The apparent common Ethereum depositor was also a service: **LI.FI AcrossFacetPacked**. The original transactions show A/B each bridged from their own same-address Ethereum wallet.','',
'**Recommendation:** Review possible coordination. This evidence alone does not justify attributing these wallets to the first-place submitter or calling their 105 votes proven self-votes.','',
'## Evidence and limits','',
'[Detailed evidence and transaction links](evidence-appendix.md) · [NFT timeline CSV](nft-timeline.csv) · [ETH ledger CSV](native-transfer-ledger.csv) · [Ballots CSV](wallet-votes.csv)','',
'NFT histories use the prior full contract-event scan through Base block **53,000,299** plus fresh receipt/auction checks. Normal histories reached their final provider page. Internal histories for A/B/C/H were capped at 4,000 records each. Other tokens/chains, private arrangements and all possible intermediary wallets are not covered.','',
'**Read-only:** No votes, winners, accounts or production data changed.',''
].join('\n');wr('report.md',main);
const app=[
'# Evidence appendix — seven-wallet cluster','',
'## 1. Scope','',
'- Round: propoganda, ID '+db.round.id+'.',
'- Final production snapshot: '+db.metadata.cutoff+'; voting ended '+db.round.voting_ends_at+'.',
'- Source audit: '+s.sourceAudit+'.',
'- Base chain ID **8453**; Collective Nouns **'+s.contract+'**.',
'- Voting snapshot block **52,697,526**; cutoff block **53,000,299**.',
'- This follow-up reused the final production export and did not reopen production. Original database identity/read-only assertion is saved in its metadata.',
'- Original NFT scan: blocks 0–53,000,299, 54 contiguous ranges, 2,251 transfers and 34 DelegateChanged events, with no reported gaps/failed ranges/duplicates.',
'- New explorer evidence: official Etherscan MCP with explicit chain 8453; two targeted bridge-origin deposits/transactions on Ethereum chain 1. Responses and pagination are saved alongside this file.','',
'## 2. Address directory','',
'| ID | Full address / BaseScan | Yellow profile | Role |','|---|---|---|---|',
...[...s.wallets,H,I].map(w=>'| '+ids[w]+' | ['+w+'](https://basescan.org/address/'+w+') | [Profile](https://www.yellowcollective.art/profile/'+w+') | '+(w===H?'NFT supplier, outside seven':w===I?'Funding intermediary, outside seven':'Member of seven')+'; owner unknown |'),'',
'None of the seven had an identifying profile row in the saved production export. An absent profile is not evidence of concealment. H/I are additional counterparties, excluded from the seven-wallet vote totals.','',
'## 3. NFT acquisitions','',
'Received date is actual wallet delivery. Auction price comes from AuctionSettled and is matched to the final AuctionBid, its sender and native value. Bid date can precede delivery; settlement caller is not necessarily the buyer.','',
'| NFT | Recipient | Received UTC | Acquisition / ETH | Evidence |','|---|---|---|---|---|',
...nfts.map(n=>'| #'+n.token+' | '+ids[n.to]+' | '+date(n.receivedAt)+' | '+(n.purchase?'Auction **'+n.purchase.amountEth+' ETH**; winning bid '+date(n.purchase.winningBid.time):'Transfer from '+ids[n.from]+'; terms discussed below')+' | '+tx(n.tx,'receipt')+(n.purchase?' / '+tx(n.purchase.winningBid.tx,'bid'):'')+' |'),'',
'### NFT 312: likely purchase or reimbursement','',
'1. H won #312 for **0.033 ETH**, receiving it at **2024-09-15 18:31:25 UTC**.',
'2. C sent H **0.033 ETH** at **19:09:41 UTC**: '+tx(reimbursement.hash,'payment')+'.',
'3. H sent #312 to C at **19:53:59 UTC**: '+tx(nfts.find(n=>n.token==='312'&&!n.purchase).tx,'delivery')+'.',
'**INFERRED:** matching price and payment **44m18s before delivery** are consistent with an at-cost purchase/reimbursement. It was not an atomic marketplace sale. C had also placed an earlier 0.01 ETH bid in this auction. These observations do not establish common control.','',
'### NFT 399: A to E','',
'A won #399 for 0.01 ETH in November 2024 and sent it to E on 2025-01-02. Transfer transaction value was zero; receipt has NFT/voting-power logs and no ERC-20 payment event; explorer internal history reports no native payment in that transaction. No A/E native ETH movement appeared within three days before or after delivery in the collected histories. **UNKNOWN:** gift, custody, reallocation, separate sale or other arrangement. It is not a proven free gift.','',
'### NFT 313: H to F','',
'H won #313 for 0.022 ETH in September 2024 and sent it to F on 2025-01-27. No successful positive native ETH transfer between H/F was found in the collected histories. Transfer transaction value was zero, with no reported internal ETH payment or ERC-20 payment log. **UNKNOWN:** terms, separate-token/offchain payment or control relationship.','',
'## 4. Direct native ETH connections','',
'Successful positive native ETH movements only; no self-calls. Normal transactions deduplicated by hash; internal traces by hash/trace/from/to/value. Amounts sum both directions and represent gross movement, not unique capital or net funding.','',
'| Pair | Direct transactions | Internal traces | Gross ETH | First → last observed date UTC | Example |','|---|---:|---:|---:|---|---|',
...c.pairsInsideGroup.slice().sort((p,q)=>q.normal-p.normal).map(p=>{const es=p.events.slice().sort((x,y)=>x.block-y.block);return '| '+p.nodes.map(w=>ids[w]).join(' ↔ ')+' | '+p.normal+' | '+p.internal+' | '+fmt(eth(p.wei))+' | '+es[0].time.slice(0,10)+' → '+es.at(-1).time.slice(0,10)+' | '+tx(es[0].hash,'example')+' |';}),'',
'**Total: '+normalSum+' direct transactions, '+internalSum+' internal trace, 14 address pairs.** Exact amounts and hashes are in native-transfer-ledger.csv/connections.json.','',
'## 5. First observed Base funding','',
'Earliest observed successful positive native ETH inflow is not proof of wallet creation or complete multichain funding.','',
'| ID | First observed inflow UTC | Source | ETH | Evidence |','|---|---|---|---:|---|',
...c.firstSeen.map((f,i)=>'| '+ids[f.wallet]+' | '+date(f.firstObservedIncoming.time)+' | '+firstDescriptions[i]+' | '+eth(f.firstObservedIncoming.valueWei)+' | '+tx(f.firstObservedIncoming.hash)+' |'),'',
'## 6. Multistep connections','',
'### B → I → F; A → I → F','',
'- B sent I **1 ETH + 3 ETH** on **2024-09-03**: '+tx('0x4104020462a5390a6221fd53e5ede6f5dee61a3e5c536f5fde81e0a394ede155','1 ETH')+' / '+tx('0xd18024f7c692bbda82cc8ce89ac5d5bedb777281f456d994f30808aa4edd3ebc','3 ETH')+'. B later sent 0.04 ETH on 2025-01-02.',
'- A sent I **0.553 ETH** on **2024-12-19**: '+tx('0xde0dc3bc17ed9046a9d622cbb5b4a6c0ca44585a211a66d26dae912034253692')+'; another 0.05 ETH on 2025-01-02.',
'- I sent F **0.0015 ETH** on **2025-01-07**, its first observed funding: '+tx('0xfa27e2161233102c0c4badd7be04a54e014b0fdd3a1b931424772b4ccd142a13')+'.',
'These are time-ordered two-step associations. They do not prove which specific funds were used or who controls I/F. I’s reported history reached final short pages: **20 normal transactions, zero internal transactions**. I also later moved ETH with A/E.','',
'### B → H → C/F; A ↔ B → H → F','',
'- B sent H ETH five times in May–August 2024; H sent B ETH once. A/H have four direct ETH transactions and G/H have three.',
'- Example B → H, **0.00114 ETH, 2024-05-07**: '+tx('0x047765cfa022d3652631c6c7b9c17c95b8692b23635021887230befded302a9f')+'. H later purchased #312/#313 and sent them to C/F.',
'- B → H → F combines a funding relationship with a later NFT transfer. A ↔ B → H → F is a three-step association. Neither proves that B’s ETH bought #313 or that one person owns the path.',
'- H also received NFTs 302, 324, 329, 424 and 544 from auction; its other NFT dealings do not create a direct link to the first-place submitter in the full ledger.','',
'## 7. Ballots and control inference','',
'| ID | Ballot time UTC, 2026-10-23 | Total votes | Support Yellow Artists | NFTs / getVotes at snapshot | Prior recorded voting rounds |','|---|---|---:|---:|---:|---:|',
...states.map(w=>'| '+ids[w.wallet]+' | '+w.ballots[0].time.slice(11,19)+' | '+w.allocated+' | 15 | '+w.balanceOf+' / '+w.getVotes+' | '+new Set(db.voter_history.filter(v=>v.wallet_address.toLowerCase()===w.wallet&&v.round_id!==db.round.id).map(v=>v.round_id)).size+' |'),'',
'The seven cast **'+ballotCount+' allocations / 360 votes**. Entry totals: Support Yellow Artists 105; We can make it! 72; Yellow The Culture We Own 66; Paint the world Yellow 46; Perpetual Collective Machine 45; Free the DAO 19; Farcaster Eat First 7. Their first/last ballot times are 34m1.44s apart. None of the seven is a submission’s submitting address in this round.','',
'Voting rule: 50 base votes plus snapshot voting power, yielding budgets 52, 53 and five × 51; 15-per-entry cap. All seven used their full budgets. All nine NFTs held at the snapshot were already in their wallets by March 2025. No explicit DelegateChanged event involved any of the seven, H, I or the first-place submitter in the full contract scan; seven snapshot delegates are themselves.','',
'**OBSERVED, high confidence:** repeated financial relationships, verified NFT movements, concentrated ballot timing and shared support.','',
'**INFERRED, moderate confidence:** coordination or some shared control is plausible. A/B are central financial addresses. Friends, family, trading partners or a community voting together are alternatives. Shared auction participation does not establish ownership.','',
'**UNKNOWN:** human owners; any submitter’s control; intent; whether a common-control voting rule was violated. No “likely owner” is assigned from vote preference alone.','',
'## 8. Connection to first place','',
'Support Yellow Artists finished first in the saved snapshot with **318 votes**; submitter **'+s.firstPlaceSubmitter+'**. The seven supplied 105, about 33.0%. Vote support is not ownership evidence.','',
'No direct successful native ETH link to the submitter was found in the collected histories. The submitter’s own normal and internal histories both reached a short last page. No direct Collective Nouns transfer/delegation link exists in the full contract ledger.','',
'The two-step native joins found A/B/C/G and the submitter sharing '+wallet(relay)+', verified as **RelayReceiver** on Base. H also shares this service. It is excluded from ownership inference.','',
'An undirected graph combining saved ETH edges, expanded I history and all 2,251 NFT transfers was searched up to **four edges** from each of the seven to the submitter. Exclusions: mint/burn, Collective Nouns auction, DAO source of token 780, RelayReceiver, Across SpokePool. **No path remained in this bounded graph.** This does not cover every intermediary, token or chain.','',
'### Rejected apparent common Ethereum funder','',
'Base FilledV3Relay events show the same Ethereum depositor **0xe397c4883ec89ed4fc9d258f00c689708b2799c9** for A/B. Verified Ethereum source identifies it as **LI.FI AcrossFacetPacked**, a service contract. Matching origin deposit IDs/destination/recipient to the original transactions shows:','',
...bridges.map(b=>'- **'+ids[b.wallet]+'**: Ethereum sender **'+b.ethereumTransaction.from+'** → bridge contracts → same address on Base. '+tx(b.ethereumTransaction.hash,'Ethereum origin','eth')+' / '+tx(b.baseReceipt,'Base fill')+'. Deposit ID '+b.fill.args.depositId+'.'),'',
'Thus each hub bridged from its own same-address Ethereum account. A common human-controlled origin was not established. Base relayers are service actors, not the owners of these wallets.','',
'## 9. Coverage and limitations','',
'| Address | Normal rows | Normal pagination | Internal rows | Internal pagination |','|---|---:|---|---:|---|',
...[...s.wallets,H,s.firstPlaceSubmitter].map(w=>{const ns=c.coverage.filter(p=>p.address===w&&p.kind==='normal'),is=c.coverage.filter(p=>p.address===w&&p.kind==='internal');return '| '+(ids[w]||'First-place submitter')+' | '+ns.reduce((n,p)=>n+p.rows,0)+' | '+(ns.at(-1).rows<1000?'short final page':'capped')+' | '+is.reduce((n,p)=>n+p.rows,0)+' | '+(is.at(-1).rows<1000?'short final page':'**capped at four pages**')+' |';}),'',
'- Account queries: genesis through Base 53,000,299, ascending, 1,000/page. Short pages establish provider-reported completion, not independent indexer completeness.',
'- A/B/C/H internal traces stop at 4,000 ascending records each; later internal activity may be missing. D/E/F/G/I/submitter reached short pages.',
'- No comprehensive ERC-20, unrelated NFT, global intermediary or crosschain identity crawl was performed. NFT payment absence in one transaction does not exclude separate arrangements.',
'- Initial RPC AuctionBid query returned no matching bids; it was not treated as evidence of absence. Official explorer ranges returned matching events. Ten auction ranges each returned fewer than 1,000 logs.',
'- Event signatures and actual historical data match the explorer implementation ABI. Historical implementation continuity is not assumed.',
'- Each NFT receipt, winner, amount, final bid sender/value, timestamp and first-funding origin was checked. Prior independent Base RPC ledger/state artifacts corroborate NFT ownership and snapshot power.',
'- Graph paths express association; they do not establish intent, identity, common control or provenance of individual units of ETH.','',
'Address joins use exact case-normalized full addresses. Similar-looking prefix/suffix dust-transfer addresses are not merged with H, A or other subjects.','',
'## 10. Artifacts and reproduction','',
'- report.md: concise findings; report-data.json: structured conclusions/coverage.',
'- nft-acquisitions.json / nft-timeline.csv: full auction and transfer evidence.',
'- connections.json / native-transfer-ledger.csv: pair analysis and exact ETH movements, seven plus H/I.',
'- wallet-votes.csv: all '+ballotCount+' allocations, with IDs.',
'- verification.json: derivation checks; evidence-manifest.json: file SHA-256 hashes.',
'- Original explorer JSON responses and source/ABIs are saved beside the report.',
'- Rebuild from saved evidence by running analyze-connections.cjs, collect-nft-acquisitions.cjs, then build-report.cjs in this folder with Node from the repository.',
'',
'No application source, votes, winners, accounts, production data, automation state, Obsidian files, plugin configuration or memory changed. Memory was read only for historical audit procedure; report counts use the final saved snapshot and chain evidence.',''
].join('\n');wr('evidence-appendix.md',app);
const checks=[];function check(name,ok){checks.push({name,ok});if(!ok)throw Error(name);}
check('seven unique wallets',new Set(s.wallets).size===7);
check('194 direct plus 1 internal ETH movement, 14 pairs',normalSum===194&&internalSum===1&&c.pairsInsideGroup.length===14);
check('13 NFT movements, 10 auctions',nfts.length===13&&nfts.filter(n=>n.purchase).length===10);
for(const n of nfts){const r=rd('receipt-'+n.tx+'.json').result,l=r.logs.find(l=>Number(l.logIndex)===n.logIndex);check('NFT receipt '+n.token+' '+n.tx,r.status==='0x1'&&l.address.toLowerCase()===s.contract&&'0x'+l.topics[1].slice(-40)===n.from&&'0x'+l.topics[2].slice(-40)===n.to&&String(BigInt(l.topics[3]))===n.token);if(n.purchase){const p=n.purchase,b=p.winningBid.transaction;check('auction payment '+n.token,p.winner===n.to&&p.winner===b.from.toLowerCase()&&b.isError==='0'&&BigInt(b.value)===BigInt(p.amountWei));}}
check('360 total votes',states.reduce((n,w)=>n+w.allocated,0)===360);
check('105 first-place votes',states.reduce((n,w)=>n+w.ballots.find(b=>b.title==='Support Yellow Artists').votes,0)===105);
check('31 allocation rows',ballotCount===31);
check('no same-address self-votes',states.every(w=>w.ballots.every(b=>b.submitter!==w.wallet)));
check('no retained first-place path within four steps',pathsToWinner.every(x=>x.path===null));
check('312 payment precedes delivery 2658 seconds',Date.parse(nfts.find(n=>n.token==='312'&&!n.purchase).receivedAt)-Date.parse(reimbursement.time)===2658000);
check('Ethereum origin senders equal Base recipients',bridges.every(b=>b.ethereumTransaction.from.toLowerCase()===b.wallet&&b.fill.args.recipient.toLowerCase()===b.wallet));
for(const b of bridges){const o=decodeEventLog({abi,data:b.ethereumDeposit.data,topics:b.ethereumDeposit.topics});check('origin deposit matches fill '+ids[b.wallet],String(o.args.depositId)===String(b.fill.args.depositId)&&String(o.args.destinationChainId)==='8453'&&o.args.recipient.toLowerCase()===b.wallet&&o.args.inputAmount===b.fill.args.inputAmount&&o.args.outputAmount===b.fill.args.outputAmount&&b.ethereumDeposit.transactionHash===b.ethereumTransaction.hash);}
wr('verification.json',{generatedAt:new Date().toISOString(),checks,passed:checks.length,failed:0});
const manifest=fs.readdirSync(D).filter(n=>n!=='evidence-manifest.json'&&fs.statSync(path.join(D,n)).isFile()).sort().map(n=>({file:n,bytes:fs.statSync(path.join(D,n)).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(D,n))).digest('hex')}));
wr('evidence-manifest.json',{generatedAt:new Date().toISOString(),files:manifest});
console.log(JSON.stringify({report:path.join(D,'report.md'),checks:checks.length,files:manifest.length,ledgerRows:selected.length,ballotCount,nftRows:nfts.length}));

