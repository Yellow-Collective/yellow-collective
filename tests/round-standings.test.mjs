import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { loadRoundMediaModule as load } from './fixtures/load-round-media-module.mjs';

const source = readFileSync('data/rounds.ts', 'utf8');
const listSource = source.slice(source.indexOf('export const listRoundSubmissions'), source.indexOf('export const finalizeRoundWinners'));
assert.doesNotMatch(listSource, /ORDER BY\s+CASE WHEN w\.winner_position/, 'stored winner positions must not override current votes');
assert.match(listSource, /vote_count DESC,\s+s\.created_at DESC,\s+s\.id ASC/, 'ties use creation time and a deterministic id');
assert.ok(existsSync('utils/rounds/standings.ts'));
const { applyRoundStandings } = load('utils/rounds/standings.ts');
const entry = (id, voteCount, winnerPosition, extra = {}) => ({ id, voteCount, winnerPosition, status: 'approved', createdAt: '2026-10-01T00:00:00Z', ...extra });
const original = { id: 'round', totalVotes: 170, winnerCount: 2, status: 'published', votingEndsAt: '2026-10-23T21:00:00Z', submissions: [entry('a', 100, 1), entry('b', 60, 2), entry('c', 10, null)], awards: [{ position: 1, value: '1 ETH' }] };
const frozen = JSON.stringify(original);
const updated = applyRoundStandings(original, { roundId: 'round', totalVotes: 75, submissions: [entry('a', 5, 1), entry('b', 60, 2), entry('c', 10, null)] });
assert.deepEqual(Array.from(updated.submissions, s => s.id), ['b', 'c', 'a']);
assert.equal(updated.totalVotes, 75);
assert.equal(updated.submissions[2].winnerPosition, 1, 'stored finalization metadata remains historical');
assert.equal(JSON.stringify(original), frozen, 'source records and award history are untouched');
assert.deepEqual(updated.awards, original.awards);
assert.deepEqual(Array.from(applyRoundStandings(original).submissions, s => s.id), ['a', 'b', 'c'], 'SSR fallback remains available');
assert.equal(applyRoundStandings(null), null);
assert.deepEqual(Array.from(applyRoundStandings(original, { roundId: 'other', submissions: [], totalVotes: 0 }).submissions, s => s.id), ['a', 'b', 'c'], 'another round response cannot overwrite this round');
const tied = applyRoundStandings({ ...original, submissions: [entry('z', 0, 1), entry('a', 0, null), entry('newer', 0, null, { createdAt: '2026-10-02T00:00:00Z' })] });
assert.deepEqual(Array.from(tied.submissions, s => s.id), ['newer', 'a', 'z']);
const moderated = applyRoundStandings(original, { roundId: 'round', totalVotes: 65, submissions: [entry('a', 100, 1, { status: 'rejected' }), entry('b', 60, 2)] });
assert.deepEqual(Array.from(moderated.submissions, s => s.id), ['b', 'a'], 'historic visible winners stay visible after approved current entries');
assert.equal(moderated.submissions[1].status, 'rejected');
assert.equal(applyRoundStandings(original, { roundId: 'round', totalVotes: 0, submissions: [] }).submissions.length, 0);

const page = readFileSync('pages/rounds/[slug].tsx', 'utf8');
assert.match(page, /applyRoundStandings\(initialRound, standings\)/);
assert.match(page, /clearRoundArtwork\(currentRound\)/);
const { clearRoundArtwork } = load('utils/rounds/roundMediaPayload.ts');
assert.equal(clearRoundArtwork(updated).totalVotes, 75, 'media failure does not roll fresh counts back to SSR');
assert.match(page, /round\.submissions\.filter\(\(submission\) => submission\.status === "approved"\)\.slice\(0, round\.winnerCount\)/);
assert.match(page, /isWinner=\{winners\.some\(\(winner\) => winner\.id === submission\.id\)\}/);
assert.match(page, /showRank=\{submission\.status === "approved" &&/);
assert.match(page, /standingsError/);

let lookup = async () => ({ roundId: 'round', totalVotes: 0, submissions: [] });
const handler = load('pages/api/rounds/[slug]/standings.ts', { 'data/rounds': { getPublicRoundStandingsBySlug: (...args) => lookup(...args) } }).default;
const invoke = async (method = 'GET', slug = 'fixture') => {
  const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method, query: { slug } }, response);
  return response;
};
assert.equal((await invoke()).code, 200);
assert.match((await invoke()).headers['Cache-Control'], /no-store/);
assert.equal((await invoke('POST')).code, 405);
assert.equal((await invoke('GET', '')).code, 400);
lookup = async () => null;
assert.equal((await invoke()).code, 404);
lookup = async () => { throw new Error('secret SQL marker'); };
assert.equal((await invoke()).code, 500);
assert.equal(JSON.stringify((await invoke()).body).includes('secret SQL marker'), false);

// Exercise the real data-access function with a database boundary stub. No schema
// initialization or winner-finalization writes are allowed during polling.
const require = createRequire(import.meta.url);
const ts = require('typescript');
const module = { exports: {} };
let queries = [];
let rows = [{ id: 'round', total_votes: 75, submissions: [{ id: 'a', status: 'approved', voteCount: 5 }] }];
const pool = { on() {}, query: async (sql, values) => { queries.push({ sql, values }); return { rows }; } };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
  module, exports: module.exports, process: { env: { DATABASE_URL: 'postgres://synthetic' } },
  require: name => name === 'pg' ? { Pool: function () { return pool; } }
    : name === '@vercel/functions' ? { attachDatabasePool() {} }
    : name.startsWith('@/') || name.startsWith('data/') ? {} : require(name),
});
const result = await module.exports.getPublicRoundStandingsBySlug("fixture' OR true --");
assert.equal(result.totalVotes, 75);
assert.equal(result.submissions[0].voteCount, 5);
assert.equal(queries.length, 1);
assert.equal(queries[0].values[0], "fixture' OR true --");
assert.equal(queries[0].sql.includes("fixture'"), false);
assert.match(queries[0].sql, /r\.status = 'published' AND r\.active = true/);
assert.match(queries[0].sql, /r\.deleted_at IS NULL/);
assert.match(queries[0].sql, /s\.deleted_at IS NULL/);
assert.match(queries[0].sql, /s\.status = 'approved' OR EXISTS/);
assert.doesNotMatch(queries[0].sql, /\b(UPDATE|INSERT|DELETE|CREATE|ALTER)\b/);
assert.doesNotMatch(queries[0].sql, /wallet_address|image|source_payload/);
rows = [];
assert.equal(await module.exports.getPublicRoundStandingsBySlug('missing'), null);
console.log('ok - live standings supersede frozen winners, deterministic ties, moderation/empty/SSR fallback, historical metadata preserved, public endpoint failure boundaries');
