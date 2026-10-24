const {Client}=require('pg');
const fs=require('fs');
const path=require('path');
const PROJECT='af512d4f-60b5-42a8-b7dc-bf337fa00c1d';
const SERVICE='9472c187-a023-46d2-b39e-4f42a88d3b51';
const HOST='gondola.proxy.rlwy.net';
const roundIndex=process.argv.indexOf('--round'); const slug=roundIndex>=0?process.argv[roundIndex+1]:null;
if(process.argv.includes('--help')){console.log('Usage: node collect-round-audit.cjs --round <slug-or-id>');process.exit(0);}
if(!slug||slug.startsWith('--')){console.error('Provide --round <slug-or-id>.');process.exit(2);}
const cs=process.env.DATABASE_PUBLIC_URL||process.env.DATABASE_URL;
if(!cs){console.error('Railway DB URL not injected; no query run.');process.exit(2);}
(async()=>{
 const u=new URL(cs);
 if(u.hostname!==HOST)throw Error('Unexpected database host; no query run.');
 const db=new Client({connectionString:cs,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(path.join(__dirname,'railway-root.crt')),checkServerIdentity:(_host,cert)=>{const pinned=new (require('crypto').X509Certificate)(fs.readFileSync(path.join(__dirname,'railway-server.crt')));if(cert.fingerprint256!==pinned.fingerprint256)return Error('Authenticated service certificate pin mismatch');}},connectionTimeoutMillis:10000,application_name:'yellow-round-vote-audit-readonly'});
 await db.connect();
 try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await db.query('SET LOCAL statement_timeout=30000');
  const q=async(sql,p=[]) => (await db.query(sql,p)).rows;
  const m=(await q("SELECT transaction_timestamp() cutoff,current_database() database,current_setting('transaction_read_only') read_only"))[0];
  if(m.database!=='railway'||m.read_only!=='on')throw Error('Database identity or read-only assertion failed.');
  const rr=await q('SELECT to_jsonb(r) record FROM rounds r WHERE r.slug=$1 OR r.id::text=$1',[slug]);
  if(rr.length!==1)throw Error('Round did not resolve uniquely.');
  const round=rr[0].record;
  if(!round.voting_ends_at||Date.parse(round.voting_ends_at)>Date.parse(m.cutoff))throw Error('Round is not confirmed closed.');
  const rid=round.id;
  const submissions=(await q("SELECT to_jsonb(s)-'image'-'images'-'source_payload' record FROM round_submissions s WHERE s.round_id=$1 ORDER BY s.created_at,s.id",[rid])).map(x=>x.record);
  const votes=(await q('SELECT to_jsonb(v) record FROM round_votes v WHERE v.round_id=$1 ORDER BY v.created_at,v.id',[rid])).map(x=>x.record);
  const wallets=[...new Set(votes.map(v=>String(v.wallet_address||'').toLowerCase()).filter(Boolean))];
  const submitters=[...new Set(submissions.map(s=>String(s.wallet_address||'').toLowerCase()).filter(Boolean))];
  const history=wallets.length?await q('SELECT v.id,v.round_id,r.slug round_slug,v.submission_id,lower(v.wallet_address) wallet_address,v.vote_count,v.created_at,s.title submission_title,lower(s.wallet_address) submitting_wallet,s.status submission_status,s.deleted_at submission_deleted_at FROM round_votes v JOIN rounds r ON r.id=v.round_id JOIN round_submissions s ON s.id=v.submission_id AND s.round_id=v.round_id WHERE lower(v.wallet_address)=ANY($1::text[]) ORDER BY lower(v.wallet_address),v.created_at,v.id',[wallets]):[];
  const authored=submitters.length?await q('SELECT s.id,s.round_id,r.slug round_slug,s.title,lower(s.wallet_address) wallet_address,s.status,s.created_at,s.deleted_at FROM round_submissions s JOIN rounds r ON r.id=s.round_id WHERE lower(s.wallet_address)=ANY($1::text[]) ORDER BY lower(s.wallet_address),s.created_at,s.id',[submitters]):[];
  const authoredIds=authored.map(s=>s.id);
  const ownVotes=authoredIds.length?await q('SELECT v.id,v.round_id,r.slug round_slug,v.submission_id,s.title submission_title,lower(s.wallet_address) submitting_wallet,lower(v.wallet_address) wallet_address,v.vote_count,v.created_at,s.status submission_status FROM round_votes v JOIN rounds r ON r.id=v.round_id JOIN round_submissions s ON s.id=v.submission_id AND s.round_id=v.round_id WHERE v.submission_id=ANY($1::text[]) ORDER BY r.slug,s.created_at,v.created_at',[authoredIds]):[];
  const addrs=[...new Set([...wallets,...submitters,...ownVotes.map(v=>v.wallet_address)])];
  const profiles=addrs.length?await q('SELECT lower(wallet_address) wallet_address,username,website_url,farcaster,twitter FROM profile_metadata WHERE lower(wallet_address)=ANY($1::text[])',[addrs]):[];
  const winners=await q('SELECT * FROM round_winners WHERE round_id=$1 ORDER BY winner_position',[rid]);
  const moderation=await q('SELECT * FROM round_vote_admin_audit WHERE round_id=$1 ORDER BY created_at,id',[rid]);
  const awards=await q('SELECT * FROM round_awards WHERE round_id=$1 ORDER BY award_position',[rid]);
  const bySubmission=new Map(submissions.map(s=>[s.id,s]));
  const patterns=wallets.map(w=>{
   const h=history.filter(v=>v.wallet_address===w);
   const b=submitters.map(s=>{const z=h.filter(v=>v.submitting_wallet===s);return z.length?{submitter:s,ballots:z.length,rounds:new Set(z.map(v=>v.round_id)).size,entries:[...new Set(z.map(v=>v.submission_id))],votes:z.reduce((n,v)=>n+Number(v.vote_count||0),0)}:null;}).filter(Boolean);
   const current=votes.filter(v=>String(v.wallet_address).toLowerCase()===w);
   return {wallet:w,round_ballot_rows:current.length,round_votes:current.reduce((n,v)=>n+Number(v.vote_count||0),0),historical_ballot_rows:h.length,historical_rounds:new Set(h.map(v=>v.round_id)).size,historical_votes:h.reduce((n,v)=>n+Number(v.vote_count||0),0),only_votes_for_round_submitters:h.length>0&&h.every(v=>submitters.includes(v.submitting_wallet)),submitter_breakdown:b,ballots:current.map(v=>({submission_id:v.submission_id,title:bySubmission.get(v.submission_id)?.title||null,submitter:String(bySubmission.get(v.submission_id)?.wallet_address||'').toLowerCase(),votes:Number(v.vote_count||0),created_at:v.created_at}))};
  });
  const totals={submissions:submissions.length,vote_rows:votes.length,voters:wallets.length,allocated_votes:votes.reduce((n,v)=>n+Number(v.vote_count||0),0),orphaned_votes:votes.filter(v=>!bySubmission.has(v.submission_id)).length,direct_self_vote_rows:votes.filter(v=>bySubmission.has(v.submission_id)&&String(v.wallet_address).toLowerCase()===String(bySubmission.get(v.submission_id).wallet_address).toLowerCase()).length,winners:winners.length,moderation_rows:moderation.length,awards:awards.length};
  const snapshot={metadata:{cutoff:m.cutoff,database:m.database,host:u.hostname,read_only:m.read_only,project:PROJECT,environment:'production',service:SERVICE,round_key:slug,round_id:rid},round,submissions,votes,voter_history:history,submitter_submissions:authored,votes_for_submitter_submissions:ownVotes,profiles,winners,moderation,awards,totals};
  await db.query('ROLLBACK');
  const safe=String(round.slug||rid).toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,60);
  const stamp=new Date(m.cutoff).toISOString().replace(/[:.]/g,'-');
  const root=path.resolve('output','audits');
  const out=path.resolve(root,'round-'+safe+'-'+stamp);
  if(!out.startsWith(root+path.sep))throw Error('Invalid output path.');
  fs.mkdirSync(out);
  const write=(name,data)=>fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n',{flag:'wx'});
  write('database-snapshot.json',snapshot);
  write('wallet-patterns.json',{cutoff:m.cutoff,round_slug:round.slug,round_id:rid,wallets:patterns});
  write('database-manifest.json',{cutoff:m.cutoff,round_slug:round.slug,round_id:rid,host:u.hostname,database:m.database,read_only:m.read_only,counts:totals});
  console.log(JSON.stringify({status:'ok',output:path.relative(process.cwd(),out),cutoff:m.cutoff,round:round.slug,counts:totals}));
 }finally{await db.end();}
})().catch(e=>{console.error(JSON.stringify({status:'failed',message:String(e.message||e).slice(0,220),code:e.code||null}));process.exitCode=1;});







