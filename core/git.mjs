import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { Hold, safePath } from './safety.mjs';

export function git(root, args) {
  const env = {};
  for (const name of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) if (process.env[name]) env[name] = process.env[name];
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_TERMINAL_PROMPT: '0' });
  return execFileSync('git', ['-c', 'core.hooksPath=' + path.join(root, '.runtime/no-hooks'), '-c', 'commit.gpgsign=false', '-c', 'user.name=KADP Independent Proto', '-c', 'user.email=proto@localhost', ...args], { cwd: root, env, windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 }).trim();
}
export function clean(root) { if (git(root, ['status', '--porcelain'])) throw new Hold('保存前の変更があります。上書きを防ぐため停止しました。', 'WAITING_HUMAN'); }
export function isolate(root, id, base) {
  const relative = '.runtime/candidates/' + id; const folder = safePath(root, relative);
  fs.mkdirSync(path.dirname(folder), { recursive: true });
  git(root, ['worktree', 'add', '--detach', folder, base]); return folder;
}
export function promote(root, isolated, baseline, paths, record, check) {
  check(); clean(root);
  if (git(root, ['rev-parse', 'HEAD']) !== baseline) throw new Hold('基準commitが変わったため昇格しません。');
  const evidencePath = 'evidence/' + record.id + '.json';
  fs.mkdirSync(safePath(isolated, 'evidence'), { recursive: true });
  fs.writeFileSync(safePath(isolated, evidencePath), JSON.stringify(record, null, 2) + '\n');
  git(isolated, ['add', '--', ...paths, evidencePath]);
  const staged = git(isolated, ['diff', '--cached', '--name-only']).split(/\r?\n/);
  if (staged.some(n => ![...paths, evidencePath].includes(n))) throw new Hold('未許可の差分を拒否しました。');
  git(isolated, ['commit', '-m', 'Verified candidate ' + record.id]);
  const commit = git(isolated, ['rev-parse', 'HEAD']);
  check(); clean(root);
  if (git(root, ['rev-parse', 'HEAD']) !== baseline) throw new Hold('昇格直前に基準が変わりました。');
  git(root, ['merge', '--ff-only', commit]);
  return commit;
}
