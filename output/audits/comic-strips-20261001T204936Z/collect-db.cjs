const {Client}=require('pg');
const fs=require('fs');
const path=require('path');
const roundId='c9569c28-f599-47cb-8dc3-31e890b977da';
const filename=process.argv[2]||'database-snapshot.json';
if(!/^database-snapshot(?:-preclose)?\.json$/.test(filename))throw new Error('Invalid output name');
const queries=[];
(async()=>{
 const s=process.env.DATABASE_PUBLIC_URL||process.env.DATABASE_URL;
 const client=new Client({connectionString:s,ssl:s.includes('railway.internal')?undefined:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
 try{
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query('SET LOCAL statement_timeout = 15000');
  async function q(sql,params=[]){queries.push({sql,params});return (await client.query(sql,params)).rows;}
  const meta=(await q("SELECT transaction_timestamp() AS cutoff, current_database() AS database, current_setting('transaction_read_only') AS read_only"))[0];
  const round=(await q("SELECT to_jsonb(r)-'image' AS record FROM rounds r WHERE r.id=$1",[roundId])).map(r=>r.record);
  if(round.length!==1||round[0].slug!=='comic-strips')throw new Error('Target identity mismatch');
  const submissions=(await q("SELECT to_jsonb(s)-'image'-'images'-'source_payload' AS record FROM round_submissions s WHERE s.round_id=$1 ORDER BY s.created_at,s.id LIMIT 2000",[roundId])).map(r=>r.record);
  const votes=await q('SELECT * FROM round_votes WHERE round_id=$1 ORDER BY created_at,id LIMIT 10000',[roundId]);
  const audits=await q('SELECT * FROM round_vote_admin_audit WHERE round_id=$1 ORDER BY created_at,id LIMIT 10000',[roundId]);
  const awards=await q('SELECT * FROM round_awards WHERE round_id=$1 ORDER BY award_position',[roundId]);
  const winners=await q('SELECT * FROM round_winners WHERE round_id=$1 ORDER BY winner_position',[roundId]);
  const addresses=[...new Set([...votes.map(v=>v.wallet_address.toLowerCase()),...submissions.map(s=>s.wallet_address.toLowerCase())])];
  const profiles=await q('SELECT wallet_address,username,website_url,farcaster,twitter,created_at,updated_at FROM profile_metadata WHERE lower(wallet_address)=ANY($1::text[]) LIMIT 2000',[addresses]);
  const otherVotes=await q('SELECT v.*,r.slug,r.title AS round_title,r.voting_snapshot_block,r.voting_strategy,r.votes_per_wallet,s.title AS submission_title,s.wallet_address AS submitting_wallet,s.status AS submission_status,s.deleted_at AS submission_deleted_at FROM round_votes v JOIN rounds r ON r.id=v.round_id JOIN round_submissions s ON s.id=v.submission_id AND s.round_id=v.round_id WHERE lower(v.wallet_address)=ANY($1::text[]) AND v.round_id<>$2 ORDER BY v.created_at,v.id LIMIT 10000',[addresses,roundId]);
  const otherSubmissions=await q('SELECT s.id,s.round_id,r.slug,s.title,s.wallet_address,s.status,s.created_at,s.updated_at,s.deleted_at FROM round_submissions s JOIN rounds r ON r.id=s.round_id WHERE lower(s.wallet_address)=ANY($1::text[]) AND s.round_id<>$2 ORDER BY s.created_at LIMIT 5000',[addresses,roundId]);
  const counts=(await q('SELECT (SELECT count(*) FROM round_submissions WHERE round_id=$1) AS submissions,(SELECT count(*) FROM round_votes WHERE round_id=$1) AS votes,(SELECT count(*) FROM round_vote_admin_audit WHERE round_id=$1) AS audits',[roundId]))[0];
  const snapshot={metadata:{...meta,project:'BuilderOS',projectId:'af512d4f-60b5-42a8-b7dc-bf337fa00c1d',serviceId:'9472c187-a023-46d2-b39e-4f42a88d3b51',host:new URL(s).hostname},round:round[0],submissions,votes,audits,awards,winners,profiles,otherVotes,otherSubmissions,counts};
  await client.query('ROLLBACK');
  fs.writeFileSync(path.join(__dirname,filename),JSON.stringify(snapshot,null,2));
  fs.writeFileSync(path.join(__dirname,'read-only-queries.json'),JSON.stringify(queries,null,2));
  console.log(JSON.stringify({output:filename,metadata:snapshot.metadata,counts,voterCount:new Set(votes.map(v=>v.wallet_address.toLowerCase())).size,participantCount:addresses.length,totalVotes:votes.reduce((n,v)=>n+v.vote_count,0),auditCount:audits.length,winnerCount:winners.length,otherVoteRows:otherVotes.length,otherSubmissionCount:otherSubmissions.length,round:round[0]}));
 }catch(e){console.log(JSON.stringify({status:'QUERY_FAILED',errorCode:e.code||null,errorType:e.constructor.name}));process.exitCode=1;}
 finally{await client.end();}
})();
