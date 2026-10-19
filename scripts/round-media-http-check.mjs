import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const origin = 'http://127.0.0.1:3100';
const report = [];
const get = async (path, options) => {
  const response = await fetch(origin + path, options);
  const bytes = Buffer.from(await response.arrayBuffer());
  report.push({ path, status: response.status, bytes: bytes.length, cache: response.headers.get('cache-control'), etag: response.headers.get('etag') });
  return { response, bytes };
};
const manifest = await get('/api/rounds/bandwidth-fixture/media?v=2');
assert.equal(manifest.response.status, 200);
assert.match(manifest.response.headers.get('cache-control'), /public/);
assert.match(manifest.response.headers.get('cache-control'), /s-maxage=15/);
assert.equal(manifest.bytes.includes(Buffer.from('data:image/')), false);
const etag = manifest.response.headers.get('etag');
if (etag) {
  const conditional = await get('/api/rounds/bandwidth-fixture/media?v=2', { cache: 'force-cache', headers: { 'If-None-Match': etag } });
  assert.equal(conditional.response.status, 304);
  assert.equal(conditional.bytes.length, 0);
}
const legacy = await get('/api/rounds/bandwidth-fixture/media');
assert.equal(JSON.parse(legacy.bytes).submissionImages['submission-000'].includes('variant=original'), true);
const gif = await get('/api/rounds/bandwidth-fixture/asset?id=submission-000&index=2&variant=original');
assert.equal(gif.response.status, 200);
assert.equal(gif.response.headers.get('content-type'), 'image/gif');
assert.match(gif.response.headers.get('cache-control'), /no-store/);
assert.equal(createHash('sha256').update(gif.bytes).digest('hex'), 'af3b049ea9ae0d4a51d695340db65672e248e584f3aa6fb767ac0e42b1c5b513');
const gridGif = await get('/api/rounds/bandwidth-fixture/asset?id=submission-002&index=0&variant=preview');
assert.equal(gridGif.response.headers.get('content-type'), 'image/gif');
assert.deepEqual(gridGif.bytes, gif.bytes, 'the grid receives the intact animated GIF without opening an entry');
for (const [path, status] of [['/api/rounds/bandwidth-fixture/asset?id=absent&index=0&variant=original', 404], ['/api/rounds/bandwidth-fixture/asset?id=submission-000&index=invalid&variant=original', 400], ['/api/rounds/bandwidth-fixture/vote', 405]]) {
  const result = await get(path);
  assert.equal(result.response.status, status);
  assert.match(result.response.headers.get('cache-control'), /no-store/);
}
const html = await get('/rounds/bandwidth-fixture');
assert.equal(html.response.status, 200);
const data = JSON.parse(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s.exec(html.bytes.toString())[1]);
assert.equal(JSON.stringify(data.props).includes('data:image/'), false);
const nextData = await get(`/_next/data/${data.buildId}/rounds/bandwidth-fixture.json`);
assert.equal(nextData.response.status, 200);
assert.equal(nextData.bytes.includes(Buffer.from('data:image/')), false);
writeFileSync('output/round-media/http-check.json', JSON.stringify(report, null, 2));
console.log('ok - production-server headers, v1 compatibility, conditional 304, GIF hash, errors, SSR and Next-data');
