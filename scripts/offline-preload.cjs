// Verification only. Inherited by Next workers through NODE_OPTIONS.
const fs = require('node:fs');
const path = require('node:path');
const isEnv = (file) => typeof file === 'string' && /^\.env(?:\..+)?$/.test(path.basename(file));
for (const name of ['readFileSync', 'readFile']) {
  const original = fs[name];
  fs[name] = function(file, ...args) {
    if (isEnv(file)) {
      const error = Object.assign(new Error('Environment files disabled during isolated verification'), { code: 'ENOENT' });
      if (name === 'readFile') return args.at(-1)(error);
      throw error;
    }
    return original.call(this, file, ...args);
  };
}
const local = (host) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
const check = (host) => { if (!local(host)) throw new Error('Isolated verification blocked external network'); };
const net = require('node:net');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) {
  let options = args[0];
  if (Array.isArray(options)) options = options[0];
  if (options && typeof options === 'object') {
    if (!options.path) check(options.host || options.hostname || 'localhost');
  } else if (typeof options === 'number') check(typeof args[1] === 'string' ? args[1] : 'localhost');
  else if (typeof options === 'string' && /^\d+$/.test(options)) check(typeof args[1] === 'string' ? args[1] : 'localhost');
  return connect.apply(this, args);
};
const dns = require('node:dns');
const lookup = dns.lookup;
dns.lookup = function(host, ...args) { check(host); return lookup.call(this, host, ...args); };
const originalFetch = global.fetch;
global.fetch = function(input, init) {
  try { check(new URL(typeof input === 'string' || input instanceof URL ? input : input.url).hostname); }
  catch (error) { return Promise.reject(error); }
  return originalFetch(input, init);
};
if (process.env.YELLOW_OFFLINE_ROUND_FIXTURE === 'true') {
  const Module = require('node:module');
  const originalLoad = Module._load;
  const pg = require('./offline-round-pg.cjs');
  const pgEntry = require.resolve('pg');
  // Next externalizes pg with import(), which reaches the resolved CJS path.
  Module._load = function(name, ...args) { return name === 'pg' || name === pgEntry ? pg : originalLoad.call(this, name, ...args); };
  require.cache[pgEntry] = { id: pgEntry, filename: pgEntry, loaded: true, exports: pg };
}
