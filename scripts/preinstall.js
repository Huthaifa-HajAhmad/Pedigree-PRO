import fs from 'fs';

// Remove lockfiles if present
try {
  if (fs.existsSync('package-lock.json')) fs.unlinkSync('package-lock.json');
  if (fs.existsSync('yarn.lock')) fs.unlinkSync('yarn.lock');
} catch (e) {
  console.error('Failed to remove old lockfiles:', e);
}

const ua = process.env.npm_config_user_agent || '';
if (!ua.includes('pnpm')) {
  console.error('Use pnpm instead of npm or yarn.');
  process.exit(1);
}

console.log('preinstall check passed (pnpm detected).');
