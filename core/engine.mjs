import fs from 'node:fs';
import crypto from 'node:crypto';
import { Hold, LIMITS, TASK_TYPES, inspectTask, safePath, acquireLock, validateCandidate, sha, privateText } from './safety.mjs';
import { git, clean, isolate, promote } from './git.mjs';
import { validateApp } from './validation.mjs';
import { invoke } from './sandbox.mjs';

export const LABELS = { IDLE:'待機中', ACCEPTED:'作業受付', RUNNING:'作業中', WORKER_RUNNING:'Worker処理中', TESTING:'TEST中', COMPLETED:'完了', WAITING_HUMAN:'確認待ち', HOLD:'HOLD', STOPPED:'安全停止', ERROR:'エラー' };
export class Engine {
  constructor(root, worker) {
    this.root = root; this.worker = worker; this.active = false; this.tasks = []; this.state = 'IDLE'; this.message = '何を改善しましょうか。'; this.sessionStart = 0;
    fs.mkdirSync(safePath(root, '.runtime'), { recursive: true });
    this.stateFile = safePath(root, '.runtime/state.json');
    if (fs.existsSync(this.stateFile)) {
      try { this.tasks = JSON.parse(fs.readFileSync(this.stateFile, 'utf8')).tasks ?? []; }
      catch { this.state = 'WAITING_HUMAN'; this.message = '前回の状態を読み取れません。自動再開しません。'; }
    }
    if (fs.existsSync(safePath(root, '.runtime/task.lock'))) { this.state = 'WAITING_HUMAN'; this.message = '前回のロックが残っています。自動再開しません。'; }
    for (const t of this.tasks) if (['RUNNING','WORKER_RUNNING','TESTING','ACCEPTED'].includes(t.status)) { t.status = 'HOLD'; t.message = '前回の処理が中断されました。自動再開しません。'; }
  }
  save() {
    const tmp = safePath(this.root, '.runtime/state.next.json');
    fs.writeFileSync(tmp, JSON.stringify({ tasks: this.tasks, state: this.state, message: this.message }, null, 2)); fs.renameSync(tmp, this.stateFile);
  }
  writeAudit(task) {
    const audit = { taskId: task.id, createdAt: task.createdAt, execution: task.audit, retryCount: task.retryCount ?? 0, status: task.status, commit: task.commit ?? null, resultAvailable: Boolean(task.result) };
    const encoded = JSON.stringify(audit, null, 2) + '\n';
    fs.mkdirSync(safePath(this.root, '.runtime/audit'), { recursive: true });
    fs.writeFileSync(safePath(this.root, '.runtime/audit/' + task.id + '.json'), encoded, { flag: 'wx' });
    task.auditHash = sha(encoded);
  }
  view() { return { state: this.state, label: LABELS[this.state], message: this.message, active: this.active, tasks: this.tasks, workerReady: this.worker.ready, login: this.worker.login }; }
  buildReview(folder, changes, contextPaths, tests) {
    const tracked = new Set(contextPaths);
    const files = changes.map(change => {
      let diff;
      if (tracked.has(change.path)) {
        diff = git(folder, ['diff', '--no-ext-diff', '--unified=3', '--', change.path]);
      } else {
        const lines = change.content.replace(/\r\n/g, '\n').split('\n');
        if (lines.at(-1) === '') lines.pop();
        diff = [
          'diff --git a/' + change.path + ' b/' + change.path,
          'new file',
          '--- /dev/null',
          '+++ b/' + change.path,
          '@@ -0,0 +1,' + lines.length + ' @@',
          ...lines.map(line => '+' + line)
        ].join('\n');
      }
      return { path: change.path, kind: tracked.has(change.path) ? '変更' : '新規', diff };
    });
    const results = Array.isArray(tests?.results) ? tests.results.map(r => ({ name: r.name, pass: Boolean(r.pass) })) : [];
    return { files, tests: { pass: Boolean(tests?.pass), total: results.length, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results } };
  }
  update(task, state, message) { task.status = state; task.message = message; this.state = state; this.message = message; this.save(); }
  stop() { this.abort?.abort(); this.state = 'STOPPED'; this.message = '安全停止しました。新しい変更を反映しません。'; this.save(); }
  decide(ok) {
    if (this.active) throw new Hold('A task is still running.');

    const task = [...this.tasks].reverse().find(t =>
      t.status === 'WAITING_HUMAN' && t.pendingApproval
    );

    if (task) {
      const pending = task.pendingApproval;

      if (!ok) {
        const decision = {
          taskId: task.id,
          decision: 'NG',
          commit: null,
          candidateHash: pending.record.candidateHash,
          at: new Date().toISOString()
        };
        const encoded = JSON.stringify(decision, null, 2) + '\n';
        fs.writeFileSync(
          safePath(this.root, '.runtime/audit/' + task.id + '-decision.json'),
          encoded,
          { flag: 'wx' }
        );
        task.decisionAuditHash = sha(encoded);
        delete task.pendingApproval;
        this.update(task, 'HOLD', 'Human rejected the tested Candidate. No commit was created.');
        return;
      }

      const check = () => {
        if (this.active) throw new Hold('Another task is running.');
      };

      const commit = promote(
        this.root,
        pending.folder,
        pending.baseline,
        pending.paths,
        pending.record,
        check
      );

      task.audit.stages.gitCommit = true;
      task.commit = commit;

      const decision = {
        taskId: task.id,
        decision: 'OK',
        commit,
        candidateHash: pending.record.candidateHash,
        at: new Date().toISOString()
      };
      const encoded = JSON.stringify(decision, null, 2) + '\n';
      fs.writeFileSync(
        safePath(this.root, '.runtime/audit/' + task.id + '-decision.json'),
        encoded,
        { flag: 'wx' }
      );
      task.decisionAuditHash = sha(encoded);

      delete task.pendingApproval;
      this.update(task, 'COMPLETED', 'Human approved the tested Candidate. The same Candidate was committed.');
      return;
    }

    if (!ok) { this.stop(); return; }

    // Existing acknowledgement behavior for blocked/non-approval tasks.
    this.state = 'IDLE';
    this.message = 'Acknowledged. No additional authority was granted.';
    this.save();
  }
  accept(text, meta = {}) {
    if (this.active) throw new Hold('別の作業を実行中です。完了を待つかSTOPしてください。');
    const source = meta.source === 'GUI' ? 'GUI' : 'INTERNAL';
    const audit = { source, stages: { worker: false, candidate: false, safety: false, isolatedApply: false, test: false, gitCommit: false }, codexIntervention: false };
    Object.defineProperty(audit, 'codexIntervention', { value: false, enumerable: true, writable: false, configurable: false });
    const kind = meta.kind ?? TASK_TYPES.CHANGE;
    const task = { id: crypto.randomUUID(), kind, text: '', status: 'ACCEPTED', dependencies: [], attempts: [], createdAt: new Date().toISOString(), audit };
    try { task.text = inspectTask(text, kind); }
    catch (e) { this.tasks.push(task); this.update(task, e.state ?? 'HOLD', e.message); return task; }
    this.tasks.push(task); this.update(task, 'ACCEPTED', '作業を受け付けました。');
    this.active = true; this.abort = new AbortController();
    this.running = this.run(task).finally(() => { this.active = false; this.save(); });
    return task;
  }
  async run(task) {
    let release; const started = Date.now(); let prior = null; let repeat = 0; let lastFingerprint = '';
    const check = () => {
      if (this.abort.signal.aborted) throw new Hold('STOPにより変更の反映を中止しました。', 'STOPPED');
      if (Date.now() - started >= LIMITS.taskMs || (this.sessionStart && Date.now() - this.sessionStart >= LIMITS.sessionMs)) throw new Hold('制限時間に達しました。');
    };
    const timer = setTimeout(() => this.abort.abort(), LIMITS.taskMs);
    try {
      release = acquireLock(this.root); check(); clean(this.root);
      const baseline = git(this.root, ['rev-parse', 'HEAD']); task.baseline = baseline;
      const contextPaths = git(this.root, ['ls-files', 'app', 'cases', 'KADP_MASTER_SPEC.md']).split(/\r?\n/).filter(Boolean);
      const context = contextPaths.map(p => ({ path:p, content:fs.readFileSync(safePath(this.root,p),'utf8') }));
      if (privateText(JSON.stringify(context))) throw new Hold('コードに秘密情報の疑いがあるため送信しません。');
      for (let attempt = 1; attempt <= LIMITS.attempts; attempt++) { task.retryCount = attempt;
        check(); this.update(task, 'RUNNING', '安全な作業領域を確認しています。');
        try {
          this.update(task, 'WORKER_RUNNING', '変更案を作成しています。');
          const output = await this.worker.propose({ task: task.text, kind: task.kind, repository: context, allowedPaths: ['app/*.js','NEW cases/*.json'], constraints: LIMITS, previousFailure: prior }, this.abort.signal);
          task.audit.stages.worker = true; check(); validateCandidate(this.root, output.candidate, contextPaths.filter(p => p.startsWith('cases/'))); task.audit.stages.candidate = true; task.audit.stages.safety = true;
          const changes = output.candidate.files;
          if (changes.every(f => context.find(c=>c.path===f.path)?.content === f.content)) throw new Hold('実際の変更がありません。');
          const id = task.id + '-' + attempt;
          const folder = isolate(this.root, id, baseline);
          for (const f of changes) fs.writeFileSync(safePath(folder, f.path), f.content);
          task.audit.stages.isolatedApply = true;
          this.update(task, 'TESTING', '隔離した変更案をTESTしています。');
          const tests = await validateApp(folder, task.text); check(); task.audit.stages.test = tests.pass;
          const record = { id, baseline, task: task.text, at: new Date().toISOString(), worker: output.evidence, candidate: output.candidate, tests, candidateHash: sha(JSON.stringify(output.candidate)), status: tests.pass ? 'TESTED' : 'HOLD' };
          // Only validated non-secret Candidate data and trusted test results are persisted.
          fs.mkdirSync(safePath(this.root, '.runtime/evidence'), { recursive: true });
          fs.writeFileSync(safePath(this.root, '.runtime/evidence/' + id + '.json'), JSON.stringify(record, null, 2));
          task.attempts.push({ attempt, tests, worker: output.evidence, candidateHash: record.candidateHash }); this.save();
          if (!tests.pass) { prior = { failedTests: tests.results.filter(t=>!t.pass), previousCandidate: output.candidate }; throw new Hold('TESTが失敗しました。安定版には反映しません。'); }
          task.tests = tests;
          task.changes = changes.map(f=>f.path);
          task.summary = output.candidate.summary;
          task.durationMs = Date.now() - started;

          const requiresHumanApproval = task.kind === TASK_TYPES.SELF_DEVELOPMENT_CHANGE || task.audit.source === 'GUI';
          if (requiresHumanApproval) {
            task.review = this.buildReview(folder, changes, contextPaths, tests);
            task.pendingApproval = {
              folder,
              baseline,
              paths: task.changes,
              record
            };
            this.update(task, 'WAITING_HUMAN', 'TEST PASS. Human approval is required before Git commit.');
            return;
          }

          check(); const commit = promote(this.root, folder, baseline, changes.map(f=>f.path), record, check); task.audit.stages.gitCommit = true;
          task.commit = commit;
          let result = '作業が完了しました。';
          try { result = await invoke(this.root, 'formatResult', { ok:true, durationMs:task.durationMs }); } catch { /* trusted factual completion remains available */ }
          task.result = typeof result === 'string' ? result : '作業が完了しました。';
          this.update(task, 'COMPLETED', 'TEST成功・Git記録まで完了しました。'); return;
        } catch (e) {
          if (this.worker.diagnostic) task.audit.workerDiagnostic = this.worker.diagnostic;
          check();
          const fingerprint = sha(JSON.stringify(prior?.failedTests ?? e.message));
          repeat = fingerprint === lastFingerprint ? repeat + 1 : 1; lastFingerprint = fingerprint;
          if (e.state === 'WAITING_HUMAN' || e.state === 'STOPPED') throw e;
          if (attempt === LIMITS.attempts || repeat >= LIMITS.sameFailure) throw new Hold(e.message || '同一失敗が上限に達しました。', 'HOLD');
          prior ??= { error: e instanceof Hold ? e.message : '内部検証エラー' };
        }
      }
    } catch (e) {
      task.durationMs = Date.now() - started;
      this.update(task, e.state ?? 'ERROR', e instanceof Hold ? e.message : '内部検証で停止しました。変更は成功扱いにしません。');
    } finally { clearTimeout(timer); if (release) release(); try { this.writeAudit(task); } catch {} this.save(); }
  }
  async startSession(text) {
    if (this.active) throw new Hold('別の作業を実行中です。');
    const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if (!lines.length || lines.length > LIMITS.tasks) throw new Hold('まとめる作業は1〜6件にしてください。');
    const tasks = lines.map(line => { const audit={source:'UNATTENDED',stages:{worker:false,candidate:false,safety:false,isolatedApply:false,test:false,gitCommit:false},codexIntervention:false}; Object.defineProperty(audit,'codexIntervention',{value:false,enumerable:true,writable:false,configurable:false}); const task={id:crypto.randomUUID(),text:line,status:'READY',dependencies:[],attempts:[],createdAt:new Date().toISOString(),audit}; try { task.text=inspectTask(line); } catch(e) { task.status=e.state??'HOLD'; task.message=e.message; } return task; });
    this.tasks.push(...tasks); for (const task of tasks.filter(t => t.status !== 'READY')) { try { this.writeAudit(task); } catch {} } this.active = true; this.abort = new AbortController(); this.sessionStart = Date.now(); this.save();
    // Generic protected action dispatcher. The initial pure plan implementation always stops.
    // Selection/continuation behavior belongs to the independently developed app/workflow.js.
    this.running = (async () => {
      try {
        for (let i=0; i<LIMITS.tasks; i++) {
          if (this.abort.signal.aborted || Date.now()-this.sessionStart >= LIMITS.sessionMs) throw new Hold('セッションを安全停止しました。','STOPPED');
          const planningInput = {
            tasks: tasks.map(t => ({
              id: t.id,
              text: t.text,
              status: t.status,
              dependencies: t.dependencies
            })),
            elapsedMs: Date.now() - this.sessionStart
          };
          const decision = await invoke(this.root, 'plan', planningInput);
          if (decision?.action === 'stop') { this.state='HOLD'; this.message='継続可能な作業がないか、無人開発機能が未実装です。'; break; }
          const next = tasks.find(t=>t.id === decision?.id);
          if (decision?.action !== 'run' || !next || next.status !== 'READY' || next.dependencies.some(id=>tasks.find(t=>t.id===id)?.status !== 'COMPLETED')) throw new Hold('実行順序を安全に確認できません。');
          inspectTask(next.text); await this.run(next);
        }
      } catch(e) { this.state=e.state??'HOLD'; this.message=e instanceof Hold?e.message:'無人処理を安全に確認できず停止しました。'; }
      finally { this.active=false; this.sessionStart=0; this.save(); }
    })();
    return tasks;
  }
}
