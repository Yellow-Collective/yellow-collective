import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const load = (file, overrides = {}) => {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module, exports: module.exports, console: { error() {} },
    require: (name) => { if (!(name in overrides)) throw new Error(`Unstubbed dependency: ${name}`); return overrides[name]; } });
  return module.exports;
};
let commits = 0;
const handler = load('pages/api/rounds/[slug]/vote.ts', {
  'data/rounds': {
    getRoundBySlug: async () => ({ id: 'round', status: 'published', active: true, votingSnapshotBlock: 100, image: 'data:image/png;base64,private-marker' }),
    getOrCreateRoundVotingSnapshotBlock: async () => 100,
    castRoundVotes: async () => { commits++; return { acceptedVotes: 2, usedVotes: 7, remainingVotes: 3, images: ['private-marker'] }; },
  },
  '@/utils/rounds/server-auth': { verifyRoundWalletSignedRequest: async ({ req, res }) => {
    if (req.headers.authorization !== 'synthetic-valid-signature') { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return '0x0000000000000000000000000000000000000001';
  } },
  '@/utils/rounds/getRoundVotingPower': { getRoundVotingPower: async () => 10 },
}).default;
const invoke = async (authorization, method = 'POST') => {
  const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method, query: { slug: 'fixture' }, headers: { authorization }, body: { votes: [{ submissionId: 'entry', voteCount: 2 }] } }, response);
  return response;
};
const good = await invoke('synthetic-valid-signature');
assert.equal(good.code, 200);
assert.deepEqual(JSON.parse(JSON.stringify(good.body)), { committed: true, acceptedVotes: 2, usedVotes: 7, remainingVotes: 3, votingPower: 10, votingSnapshotBlock: 100 });
assert.ok(Buffer.byteLength(JSON.stringify(good.body)) < 2048);
assert.equal(JSON.stringify(good.body).includes('private-marker'), false);
assert.match(good.headers['Cache-Control'], /no-store/);
assert.equal((await invoke('invalid')).code, 401);
assert.equal((await invoke('synthetic-valid-signature', 'GET')).code, 405);
assert.equal(commits, 1);
const { refreshCommittedVote } = load('utils/rounds/refresh-committed-vote.ts');
let refreshed = 0;
assert.equal(await refreshCommittedVote([async () => { refreshed++; }]), 'Votes submitted.');
assert.match(await refreshCommittedVote([async () => { throw new Error('offline'); }, async () => { refreshed++; }]), /^Votes submitted\..*Do not resubmit/);
assert.match(await refreshCommittedVote([() => { throw new Error('sync'); }]), /^Votes submitted\./);
assert.equal(refreshed, 2);
console.log(`ok - vote receipt ${Buffer.byteLength(JSON.stringify(good.body))} bytes; explicit fields, auth/no-store, committed-refresh failure recovery`);
