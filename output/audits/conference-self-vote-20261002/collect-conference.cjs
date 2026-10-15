const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const targetRound = 'c9569c28-f599-47cb-8dc3-31e890b977da';
const targetSubmission = 'ad4595b8-101b-4d2c-a06f-9294d732383e';
const out = __dirname;
const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('No Railway database connection configured');
const client = new Client({ connectionString, ssl: connectionString.includes('railway.internal') ? undefined : { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
(async () => {
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query('SET LOCAL statement_timeout = 20000');
    const q = async (sql, params = []) => (await client.query(sql, params)).rows;
    const metadata = (await q("SELECT transaction_timestamp() AS cutoff, current_database() AS database, current_setting('transaction_read_only') AS read_only"))[0];
    const host = new URL(connectionString).hostname;
    if (metadata.database !== 'railway' || metadata.read_only !== 'on') throw new Error('Database name/read-only verification failed');
    const roundRows = await q('SELECT * FROM rounds WHERE id=$1', [targetRound]);
    const targetRows = await q('SELECT * FROM round_submissions WHERE id=$1 AND round_id=$2', [targetSubmission, targetRound]);
    if (roundRows.length !== 1 || roundRows[0].slug !== 'comic-strips' || targetRows.length !== 1 || targetRows[0].title !== 'Yellow Collective Conference') throw new Error('Round or submission identity mismatch');
    const directVotes = await q('SELECT * FROM round_votes WHERE round_id=$1 AND submission_id=$2 ORDER BY created_at,id', [targetRound, targetSubmission]);
    const submitter = targetRows[0].wallet_address.toLowerCase();
    const submitterSubmissions = await q('SELECT s.id,s.round_id,r.slug,r.title AS round_title,s.title,s.wallet_address,s.status,s.created_at,s.deleted_at FROM round_submissions s JOIN rounds r ON r.id=s.round_id WHERE lower(s.wallet_address)=$1 ORDER BY s.created_at,s.id', [submitter]);
    const voters = [...new Set(directVotes.map(v => v.wallet_address.toLowerCase()))];
    const participationRows = await q(`SELECT v.*,r.slug,r.title AS round_title,r.voting_snapshot_block,s.title AS submission_title,s.wallet_address AS submitting_wallet,s.status AS submission_status,s.deleted_at AS submission_deleted_at FROM round_votes v JOIN rounds r ON r.id=v.round_id JOIN round_submissions s ON s.id=v.submission_id AND s.round_id=v.round_id WHERE lower(v.wallet_address)=ANY($1::text[]) ORDER BY lower(v.wallet_address),r.slug,v.created_at,v.id`, [voters]);
    const submitterSubmissionIds = submitterSubmissions.map(s => s.id);
    const submitterVoteRows = submitterSubmissionIds.length ? await q(`SELECT v.*,r.slug,r.title AS round_title,s.title AS submission_title,s.wallet_address AS submitting_wallet,s.status AS submission_status FROM round_votes v JOIN rounds r ON r.id=v.round_id JOIN round_submissions s ON s.id=v.submission_id AND s.round_id=v.round_id WHERE v.submission_id=ANY($1::uuid[]) ORDER BY r.slug,s.created_at,v.created_at,v.id`, [submitterSubmissionIds]) : [];
    const extraAddresses = [...new Set([submitter, ...voters, ...submitterVoteRows.map(v => v.wallet_address.toLowerCase())])];
    const profiles = await q('SELECT wallet_address,username,website_url,farcaster,twitter,created_at,updated_at FROM profile_metadata WHERE lower(wallet_address)=ANY($1::text[])', [extraAddresses]);
    const countRows = await q('SELECT (SELECT count(*) FROM round_votes WHERE round_id=$1) AS all_round_vote_rows,(SELECT count(*) FROM round_submissions WHERE round_id=$1) AS all_round_submissions', [targetRound]);
    const snapshot = { metadata: { ...metadata, project: 'BuilderOS', projectId: 'af512d4f-60b5-42a8-b7dc-bf337fa00c1d', serviceId: '9472c187-a023-46d2-b39e-4f42a88d3b51', host }, round: roundRows[0], targetSubmission: targetRows[0], directVotes, submitterSubmissions, voterHistory: participationRows, submitterVoteRows, profiles, counts: countRows[0] };
    await client.query('ROLLBACK');
    fs.writeFileSync(path.join(out, 'live-conference-data.json'), JSON.stringify(snapshot, null, 2));
    const summarize = (wallet, rows) => {
      const others = rows.filter(v => v.submission_id !== targetSubmission);
      const cb = others.filter(v => v.submitting_wallet?.toLowerCase() === submitter);
      return { wallet, conferenceVotes: directVotes.find(v => v.wallet_address.toLowerCase() === wallet)?.vote_count, conferenceRows: directVotes.filter(v => v.wallet_address.toLowerCase() === wallet).length, otherRoundRows: others.filter(v => v.round_id !== targetRound).length, otherRounds: [...new Set(others.filter(v => v.round_id !== targetRound).map(v => v.slug))], votesForSubmitterOtherEntries: cb.reduce((n, v) => n + Number(v.vote_count), 0), submitterEntriesSupported: [...new Set(cb.map(v => `${v.slug}: ${v.submission_title}`))], totalOtherRoundVotes: others.filter(v => v.round_id !== targetRound).reduce((n, v) => n + Number(v.vote_count), 0), otherRoundEntries: [...new Set(others.filter(v => v.round_id !== targetRound).map(v => `${v.slug}: ${v.submission_title}`))] };
    };
    const walletSummaries = voters.map(w => summarize(w, participationRows.filter(v => v.wallet_address.toLowerCase() === w)));
    fs.writeFileSync(path.join(out, 'voter-patterns.json'), JSON.stringify(walletSummaries, null, 2));
    console.log(JSON.stringify({ cutoff: metadata.cutoff, database: metadata.database, host, readOnly: metadata.read_only, round: roundRows[0].slug, submission: { id: targetSubmission, title: targetRows[0].title, submitter }, directVoterCount: voters.length, directRows: directVotes.length, directVotesTotal: directVotes.reduce((n, v) => n + Number(v.vote_count), 0), submitterEntries: submitterSubmissions.length, crossRoundRowsForDirectVoters: participationRows.length - directVotes.length, otherBallotsOnSubmitterEntries: submitterVoteRows.length, counts: countRows[0] }));
  } finally { await client.end(); }
})().catch(e => { console.error(JSON.stringify({ error: e.message, code: e.code || null })); process.exitCode = 1; });
