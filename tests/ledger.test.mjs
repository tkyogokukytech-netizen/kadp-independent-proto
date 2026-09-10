import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Engine } from '../core/engine.mjs';

test('戦果台帳は結果を記録し、最新順で読み出せる', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kadp-ledger-'));
  const worker = { ready: false, login: { state: 'IDLE' } };
  const engine = new Engine(root, worker);
  const task = {
    id: 'ledger-test-1',
    text: '結果表示を改善して',
    status: 'COMPLETED',
    summary: '結果表示を改善',
    changes: ['app/result.js'],
    tests: { pass: true, passed: 5, total: 5 },
    independentAudit: { passed: true, decision: 'PASS' },
    baseline: 'f7c6055',
    commit: 'test-commit',
    durationMs: 42,
    attempts: [{ attempt: 1 }]
  };
  engine.writeLedger(task);
  engine.writeLedger(task);
  const entries = engine.ledger();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].outcome, '戦果');
  assert.equal(entries[0].independentAudit.decision, 'PASS');
  assert.equal(entries[0].commit, 'test-commit');
});
