import { spawnSync } from 'child_process';

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (res.error || res.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(' ')}`);
    process.exit(res.status || 1);
  }
}

console.log('Running pnpm install --frozen-lockfile');
run('pnpm', ['install', '--frozen-lockfile']);

const isSqlite = (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('sqlite:')) || process.env.DB_CLIENT === 'sqlite';

if (isSqlite) {
  console.log('Detected sqlite local-first mode; skipping db push.');
} else {
  console.log('Running pnpm --filter @workspace/db run push');
  run('pnpm', ['--filter', '@workspace/db', 'run', 'push']);
}

console.log('post-merge sequence complete.');
