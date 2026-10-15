const fs = require('fs');
const path = require('path');
const sourceDir = path.resolve(__dirname, '..', 'comic-strips-20261001T204936Z');
const db = JSON.parse(fs.readFileSync(path.join(sourceDir, 'database-snapshot.json'), 'utf8'));
const targetId = 'ad4595b8-101b-4d2c-a06f-9294d732383e';
const submitter = db.submissions.find(s => s.id === targetId).wallet_address.toLowerCase();
const submissionMap = new Map(db.submissions.map(s => [s.id, s]));
const voterRows = new Map();
for (const vote of db.votes.filter(v => v.submission_id === targetId)) voterRows.set(vote.wallet_address.toLowerCase(), { wallet: vote.wallet_address, conferenceVotes: Number(vote.vote_count) });
const allVotes = [...db.votes, ...db.otherVotes];
for (const [key, row] of voterRows) {
  const ballots = allVotes.filter(v => v.wallet_address.toLowerCase() === key);
  const detail = ballots.map(v => {
    const s = submissionMap.get(v.submission_id);
    return { round: v.slug || 'comic-strips', submission: v.submission_title || s?.title || null, submitter: (v.submitting_wallet || s?.wallet_address || '').toLowerCase(), votes: Number(v.vote_count), targetConferenceEntry: v.submission_id === targetId };
  });
  const cb6 = detail.filter(v => v.submitter === submitter);
  row.ballotCount = detail.length;
  row.totalRecordedVotes = detail.reduce((n, v) => n + v.votes, 0);
  row.votesForConferenceSubmitter = cb6.reduce((n, v) => n + v.votes, 0);
  row.onlyRecordedSubmitter = detail.length > 0 && detail.every(v => v.submitter === submitter);
  row.ballots = detail;
}
const out = { sourceCutoff: db.metadata.cutoff, sourceRound: db.round.slug, targetSubmission: { id: targetId, title: db.submissions.find(s => s.id === targetId).title, submitter: db.submissions.find(s => s.id === targetId).wallet_address }, voters: [...voterRows.values()] };
fs.writeFileSync(path.join(__dirname, 'conference-voter-patterns.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ output: 'conference-voter-patterns.json', sourceCutoff: out.sourceCutoff, voterCount: out.voters.length, onlySubmitterVoters: out.voters.filter(v => v.onlyRecordedSubmitter).map(v => ({ wallet: v.wallet, votesForConferenceSubmitter: v.votesForConferenceSubmitter })) }));
