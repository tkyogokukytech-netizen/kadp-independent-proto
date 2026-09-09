import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Engine } from '../core/engine.mjs';
import { createServer } from '../core/server.mjs';
import { git } from '../core/git.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture() {
  const root = path.join(ROOT, '.runtime', 'tests', crypto.randomUUID());
  fs.mkdirSync(root, { recursive: true });
  for (const dir of ['app', 'cases', 'ui']) fs.cpSync(path.join(ROOT, dir), path.join(root, dir), { recursive: true });
  if (fs.existsSync(path.join(root, 'cases', 'duration.json'))) fs.rmSync(path.join(root, 'cases', 'duration.json'));
  fs.writeFileSync(path.join(root, '.gitignore'), '.runtime/\n.private/\n');
  git(root, ['init', '-b', 'main']); git(root, ['add', '.']); git(root, ['commit', '-m', 'self development fixture']);
  return root;
}
const candidate = { summary: 'safe DEV/TEST self-development change', files: [{ path: 'app/self-development-e2e.js', content: "function selfDevelopmentProbe(){ return true; }" }] };
function worker() { return { ready: true, login: { state: 'IDLE' }, async propose(req) { assert.equal(req.kind, 'SELF_DEVELOPMENT_CHANGE'); return { candidate, evidence: { worker: 'TEST_SELF_DEVELOPMENT_WORKER', promptHash: 'fixture', responseHash: 'fixture' } }; } }; }

test('GUI SELF_DEVELOPMENT_CHANGE reaches TEST and dangerous self-change is rejected', async () => {
  const root = fixture();
  const { server, engine } = createServer(root, worker());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const initial = await (await fetch(`${base}/api/state`)).json();
    const headers = { 'Content-Type': 'application/json', 'X-KADP-Token': initial.csrf, Origin: base };
    const safe = await (await fetch(`${base}/api/task`, { method: 'POST', headers, body: JSON.stringify({ kind: 'SELF_DEVELOPMENT_CHANGE', text: 'SELF_DEVELOPMENT_CHANGE: safely update duration output' }) })).json();
    await engine.running;
    const state = await (await fetch(`${base}/api/state`)).json();
    const task = state.tasks.find(t => t.id === safe.id);
    assert.equal(task.kind, 'SELF_DEVELOPMENT_CHANGE');
    assert.equal(task.status, 'WAITING_HUMAN');
    assert.equal(task.tests.pass, true);
    assert.equal(task.commit, undefined);
    assert(task.pendingApproval);
    assert(task.review);
    assert.equal(task.review.tests.pass, true);
    assert(task.review.tests.total > 0);
    assert.equal(task.review.files.length, 1);
    assert.equal(task.review.files[0].path, 'app/self-development-e2e.js');
    assert.equal(task.review.files[0].kind, '新規');
    assert(task.review.files[0].diff.includes('+function selfDevelopmentProbe'));

    await fetch(`${base}/api/decision`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ok: true })
    });

    const approved = (await (await fetch(`${base}/api/state`)).json()).tasks.find(t => t.id === safe.id);
    assert.equal(approved.status, 'COMPLETED');
    assert(approved.commit);
    assert.equal(approved.pendingApproval, undefined);
    const dangerous = await (await fetch(`${base}/api/task`, { method: 'POST', headers, body: JSON.stringify({ kind: 'SELF_DEVELOPMENT_CHANGE', text: 'SELF_DEVELOPMENT_CHANGE: change core/safety.mjs' }) })).json();
    const after = (await (await fetch(`${base}/api/state`)).json()).tasks.find(t => t.id === dangerous.id);
    assert.equal(after.status, 'WAITING_HUMAN');
    assert.equal(after.commit, undefined);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

