// In-memory, read-only fixture driver, only injected by the isolated runner.
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const fixturePromise = import(pathToFileURL(path.resolve('tests/fixtures/round-media-fixture.mjs')).href)
  .then(({ makeRoundMediaFixture }) => makeRoundMediaFixture({ count: 12 }));
const row = (record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value]));
class Pool extends EventEmitter {
  async query(text, values = []) {
    const sql = typeof text === 'string' ? text : text.text;
    const seed = await fixturePromise;
    let state = {};
    try { state = JSON.parse(readFileSync(path.resolve('output/round-media/runtime-state.json'), 'utf8')); } catch {}
    const fixture = { ...seed, updatedAt: state.updatedAt || seed.updatedAt, active: state.active !== false, status: state.status || seed.status,
      submissions: seed.submissions.filter((entry) => !(state.hiddenIds || []).includes(entry.id)).map((entry) => ({ ...entry, updatedAt: state.updatedAt || entry.updatedAt, title: entry.title + (state.titleSuffix || '') })) };
    const result = (rows) => ({ rows, rowCount: rows.length });
    if (/^\s*(CREATE|ALTER|UPDATE|INSERT|DELETE|BEGIN|COMMIT|ROLLBACK|SELECT pg_advisory)/i.test(sql)) return result([]);
    if (/FROM site_settings/.test(sql)) return result([]);
    if (state.failMedia && /SELECT id, slug, updated_at/.test(sql)) throw new Error('Synthetic media failure');
    if ((!fixture.active || fixture.status !== 'published') && /status\s*=\s*'published'/.test(sql)) return result([]);
    if (/AS asset/.test(sql) && /s\.image_assets/.test(sql)) {
      const submission = fixture.submissions.find((entry) => entry.id === values[1]);
      return result(submission ? [{ round_id: fixture.id, submission_id: submission.id, updated_at: submission.updatedAt, image: submission.images[values[2]], asset: null }] : []);
    }
    if (/SELECT id AS round_id, image/.test(sql)) return result([{ round_id: fixture.id, image: fixture.image, updated_at: fixture.updatedAt }]);
    if (/SELECT s\.id, s\.updated_at/.test(sql)) return result(fixture.submissions.map((entry) => ({ id: entry.id, updated_at: entry.updatedAt, images: entry.images.map(() => '__inline__') })));
    if (/SELECT id, slug, updated_at/.test(sql)) return result([{ ...row(fixture), image: '__inline__' }]);
    if (/FROM round_submissions s/.test(sql)) return result(fixture.submissions.map(row));
    if (/FROM rounds r/.test(sql)) return result(values[0] && ![fixture.slug, fixture.id].includes(values[0]) ? [] : [row(fixture)]);
    return result([]);
  }
  async connect() { return { query: this.query.bind(this), release() {} }; }
  async end() {}
}
module.exports = { Pool };
