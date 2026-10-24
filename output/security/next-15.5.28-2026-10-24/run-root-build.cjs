const {spawn} = require('node:child_process');
const {resolve} = require('node:path');
const env = Object.fromEntries(['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP','COMSPEC','PATHEXT'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--require=' + resolve('.codex-tmp/next-security/deny-env.cjs')});
const child = spawn(process.execPath,['C:/Users/Deej/AppData/Local/node/corepack/v1/yarn/1.22.22/bin/yarn.js','build'],{env,stdio:'inherit'});
child.on('error',error=>{console.error(error);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
