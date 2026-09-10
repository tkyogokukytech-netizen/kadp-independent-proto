import test from 'node:test';
import assert from 'node:assert/strict';
import { independentlyAudit } from '../core/independent-audit.mjs';

const base = {
  request: '実行結果の表示を改善して',
  candidate: { summary: '結果表示の文言を改善', files: [{ path: 'app/result.js', content: 'function formatResult(){ return "完了"; }' }] },
  tests: { pass: true, passed: 3, total: 3 },
  baseline: 'f7c6055',
  changedPaths: ['app/result.js']
};

test('独立監査は安全なTEST済みCandidateを通過させる', () => {
  const audit = independentlyAudit(base);
  assert.equal(audit.passed, true);
  assert.equal(audit.decision, 'PASS');
  assert.equal(audit.reviewer, 'CHATGPT_INDEPENDENT_AUDITOR');
});

test('独立監査はTEST失敗を人間確認へ止める', () => {
  const audit = independentlyAudit({ ...base, tests: { pass: false, passed: 2, total: 3 } });
  assert.equal(audit.passed, false);
  assert.equal(audit.decision, 'HUMAN_REQUIRED');
  assert.equal(audit.checks.find(check => check.id === 'tests-pass').pass, false);
});

test('独立監査は高リスク内容を自動通過させない', () => {
  const audit = independentlyAudit({ ...base, request: 'PRODへ請求書を送信して' });
  assert.equal(audit.passed, false);
  assert.equal(audit.checks.find(check => check.id === 'no-high-risk-scope').pass, false);
});

test('独立監査は許可範囲外のファイルを止める', () => {
  const audit = independentlyAudit({ ...base, candidate: { ...base.candidate, files: [{ path: 'core/safety.mjs', content: 'changed' }] }, changedPaths: ['core/safety.mjs'] });
  assert.equal(audit.passed, false);
  assert.equal(audit.checks.find(check => check.id === 'safe-scope').pass, false);
});

test('独立監査は変更ファイルの申告不一致を止める', () => {
  const audit = independentlyAudit({ ...base, changedPaths: ['app/workflow.js'] });
  assert.equal(audit.passed, false);
  assert.equal(audit.checks.find(check => check.id === 'declared-paths-match').pass, false);
});

test('独立監査は依頼と噛み合わないCandidateを止める', () => {
  const audit = independentlyAudit({ ...base, request: '請求書の金額計算を変更して' });
  assert.equal(audit.passed, false);
  assert.equal(audit.checks.find(check => check.id === 'request-alignment').pass, false);
});
