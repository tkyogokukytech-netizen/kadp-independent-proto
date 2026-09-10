import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Engine } from '../core/engine.mjs';
import { git } from '../core/git.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kadp-unattended-'));
  for (const dir of ['app', 'cases', 'ui']) fs.cpSync(path.join(process.cwd(), dir), path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, '.gitignore'), '.runtime/\n.private/\n');
  git(root, ['init', '-b', 'main']);
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'unattended fixture']);
  return root;
}

test('無人セッションは安全な複数タスクを順番にTEST・監査・記録する', async () => {
  const root = fixture();
  let calls = 0;
  const originalResult = fs.readFileSync(path.join(root, 'app', 'result.js'), 'utf8');
  const worker = {
    ready: true,
    login: { state: 'IDLE', message: 'TEST ONLY' },
    async propose(request) {
      calls++;
      return {
        candidate: {
          summary: request.task,
          files: [{ path: 'app/result.js', content: `${originalResult}\n// ${request.task}\n` }]
        },
        evidence: { worker: 'TEST_UNATTENDED_WORKER', promptHash: crypto.createHash('sha256').update(request.task).digest('hex'), responseHash: 'fixture' }
      };
    }
  };
  const engine = new Engine(root, worker);
  await engine.startSession('結果表示を改善して\n完了表示を改善して');
  await engine.running;
  assert.equal(calls, 2);
  const completed = engine.tasks.filter(task => task.status === 'COMPLETED');
  assert.equal(completed.length, 2);
  assert.equal(completed.every(task => task.audit.source === 'UNATTENDED'), true);
  assert.equal(completed.every(task => task.independentAudit?.passed), true);
  assert.equal(engine.ledger().filter(entry => entry.outcome === '戦果').length, 2);
});
