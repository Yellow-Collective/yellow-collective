const fs = require('node:fs');
const path = require('node:path');
const isEnv = value => typeof value === 'string' && /^\.env(?:\..*)?$/.test(path.basename(value));
for (const method of ['statSync', 'readFileSync']) {
  const original = fs[method];
  fs[method] = function (file, ...args) {
    if (isEnv(file)) { const error = new Error('Environment files excluded from local validation'); error.code = 'ENOENT'; throw error; }
    return original.call(this, file, ...args);
  };
}
