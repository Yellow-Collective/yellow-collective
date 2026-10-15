const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const targetId = 'c9569c28-f599-47cb-8dc3-31e890b977da';
(async () => {
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) { console.log(JSON.stringify({label:process.argv[2],status:'NO_CONNECTION_VARIABLE'})); return; }
  const client = new Client({ connectionString, ssl: connectionString.includes('railway.internal') ? undefined : {rejectUnauthorized:false}, connectionTimeoutMillis:10000 });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    await client.query('SET LOCAL statement_timeout = 10000');
    const tables = await client.query("SELECT table_schema FROM information_schema.tables WHERE table_name=$1 AND table_schema NOT IN ('pg_catalog','information_schema')", ['rounds']);
    const matches=[];
    for(const {table_schema:schema} of tables.rows){
      const table='"'+schema.replaceAll('"','""')+'"."rounds"';
      const result=await client.query(`SELECT id,slug,title,voting_starts_at,voting_ends_at,voting_strategy,votes_per_wallet,voting_snapshot_block FROM ${table} WHERE id=$1 OR slug=$2 LIMIT 5`,[targetId,'comic-strips']);
      matches.push(...result.rows.map(r=>({...r,schema})));
    }
    const u=new URL(connectionString);
    const result={label:process.argv[2],checkedAt:new Date().toISOString(),host:u.hostname,database:u.pathname,connectionFingerprint:crypto.createHash('sha256').update(u.hostname+u.port+u.pathname).digest('hex'),schemasWithRounds:tables.rows.map(r=>r.table_schema),matches};
    fs.writeFileSync(path.join(__dirname,'identity-'+process.argv[2]+'.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
    await client.query('ROLLBACK');
  } catch(e){console.log(JSON.stringify({label:process.argv[2],status:'QUERY_FAILED',errorCode:e.code??null,errorType:e.constructor.name}));}
  finally{await client.end();}
})();
