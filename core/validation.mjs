import fs from 'node:fs';
import assert from 'node:assert/strict';
import { safePath } from './safety.mjs';
import { invoke } from './sandbox.mjs';

// Trusted runner. Candidate tests are data, never Node.js executables.
export async function validateApp(root, task = '') {
  const results = [];
  async function check(name, run) {
    try { await run(); results.push({ name, pass: true }); }
    catch { results.push({ name, pass: false }); }
  }
  await check('result-success', async () => assert.match(await invoke(root, 'formatResult', { ok: true, durationMs: 1432 }), /完了/));
  await check('result-failure', async () => assert.match(await invoke(root, 'formatResult', { ok: false, durationMs: 1432 }), /保留|失敗|停止/));
  await check('planner-empty', async () => assert.deepEqual(await invoke(root, 'plan', { tasks: [], elapsedMs: 0 }), { action: 'stop' }));
  for (const name of fs.readdirSync(safePath(root, 'cases')).filter(n => /^[a-z][a-z0-9_-]*\.json$/.test(n)).sort()) {
    let cases; try { cases = JSON.parse(fs.readFileSync(safePath(root, 'cases/' + name), 'utf8')); if (!Array.isArray(cases)) throw Error(); }
    catch { results.push({ name: 'case-schema:' + name, pass: false }); continue; }
    for (const [i, c] of cases.entries()) await check(name + ':' + i, async () => {
      assert(['equals', 'includes'].includes(c.op));
      const result = await invoke(root, c.fn, c.input);
      if (c.op === 'equals') assert.deepEqual(result, c.expected);
      else { assert.equal(typeof result, 'string'); assert(result.includes(c.expected)); }
    });
  }
  // Behavioral acceptance is selected by trusted code before the Worker call.
  if (/処理時間|所要時間/.test(task)) {
    for (const ms of [1432, 2786]) await check('duration:' + ms, async () => {
      const result = await invoke(root, 'formatResult', { ok: true, durationMs: ms });
      assert(/秒|ms|ミリ秒/.test(result));
      assert([String(ms), (ms / 1000).toFixed(1), (ms / 1000).toFixed(2), String(ms / 1000)].some(n => result.includes(n)));
    });
  }
  if (/無人開発.*実装/.test(task)) {
    const t = (id, status = 'READY', dependencies = []) => ({ id, status, dependencies, text: '表示を改善して' });
    for (const [name, tasks, expected] of [
      ['first-ready', [t('a'), t('b')], { action: 'run', id: 'a' }],
      ['after-success', [t('a', 'COMPLETED'), t('b')], { action: 'run', id: 'b' }],
      ['after-hold', [t('a', 'HOLD'), t('b')], { action: 'run', id: 'b' }],
      ['dependency-blocked', [t('a', 'HOLD'), t('b', 'READY', ['a'])], { action: 'stop' }],
      ['dependency-ready', [t('a', 'COMPLETED'), t('b', 'READY', ['a'])], { action: 'run', id: 'b' }],
      ['missing-dependency', [t('b', 'READY', ['missing'])], { action: 'stop' }]
    ]) await check('unattended:' + name, async () => assert.deepEqual(await invoke(root, 'plan', { tasks, elapsedMs: 100 }), expected));
  }
  return { pass: results.length > 0 && results.every(r => r.pass), results };
}
