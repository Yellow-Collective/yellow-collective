import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const [task, ...args] = process.argv.slice(2);
const fixture = args.includes('--round-fixture');
if (fixture) args.splice(args.indexOf('--round-fixture'), 1);
if (!['test', 'typecheck', 'lint', 'build', 'dev', 'start', 'node'].includes(task))
  throw new Error('Use test, typecheck, lint, build, dev, start, or node');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|HOMEDRIVE|HOMEPATH)$/i.test(key)));
Object.assign(env, {
  NODE_OPTIONS: `--require="${resolve('scripts/offline-preload.cjs').replaceAll('\\', '/')}"`,
  NEXT_TELEMETRY_DISABLED: '1',
  YELLOW_OFFLINE_VERIFICATION: 'true',
  ROUND_VIDEOS_ENABLED: 'false',
  ROUND_IMAGES_ENABLED: 'false',
});
if (!['test', 'node'].includes(task)) {
  env.DATABASE_URL = 'postgres://offline:offline@127.0.0.1:1/offline';
  env.DATABASE_PUBLIC_URL = env.DATABASE_URL;
}
if (fixture) env.YELLOW_OFFLINE_ROUND_FIXTURE = 'true';
// Run the repository's Yarn scripts, including its existing prebuild hook.
const command = task === 'node' ? process.execPath : (process.platform === 'win32' ? 'yarn.cmd' : 'yarn');
const commandArgs = task === 'node' ? args : [task, ...args];
const child = spawn(command, commandArgs, { env, stdio: 'inherit', shell: task !== 'node' && process.platform === 'win32' });
child.on('error', () => { console.error('Unable to start isolated verification command'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
