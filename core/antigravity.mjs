import { spawn } from 'node:child_process';
import path from 'node:path';
import * as pty from '@lydell/node-pty';
import { Hold, LIMITS, privateText, sha } from './safety.mjs';

// Provider adapter. Engine/Worker Interface stays provider-neutral: only this file knows agy flags.
export const ANTIGRAVITY_WORKER_ID = 'official-antigravity-cli';
export function extractOAuthUrl(output) {
  const clean = String(output).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
  const start = clean.indexOf('https://accounts.google.com/');
  if (start < 0) return null;
  let tail = clean.slice(start);
  const marker = tail.search(/Waiting for authentication|Or,? paste the authorization code/i);
  if (marker >= 0) tail = tail.slice(0, marker);
  const url = tail.replace(/[\r\n\t ]+/g, '').replace(/[.]+$/, '');
  return /^https:\/\/accounts\.google\.com\/[A-Za-z0-9/?=&+_.:%~#@\-]+$/.test(url) ? url : null;
}
export function parseCliResponse(output) {
  const clean = String(output)
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\r\n]+/g, '');
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end < start) throw Error();
  return JSON.parse(clean.slice(start, end + 1));
}
export class AntigravityWorker {
  constructor(root, executable = path.join(process.env.LOCALAPPDATA ?? '', 'agy', 'bin', 'agy.exe')) {
    this.root = root; this.executable = executable; this.ready = false; this.codeSubmitted = false; this.diagnostic = null;
    this.login = { state: 'WAITING_HUMAN', message: 'Google OAuthの本人認証が必要です。' };
  }
  run(prompt, signal) {
    this.diagnostic = { mode:'plan', outputFormat:'json', timeout:'180s', promptHash:sha(prompt), promptBytes:Buffer.byteLength(prompt) };
    if (privateText(prompt)) return Promise.reject(new Hold('送信前検査で秘密情報の可能性を検出しました。', 'WAITING_HUMAN'));
    return new Promise((resolve, reject) => {
      // Antigravity's official OAuth prompt reads from a TTY, not a redirected stdin pipe.
      const child = pty.spawn(this.executable, ['--mode', 'plan', '--output-format', 'json', '--print-timeout', '180s', '--print=' + prompt], {
        name: 'xterm-256color', cols: 120, rows: 40,
        cwd: path.join(this.root, '.private', 'worker-workspace'),
        env: { ...process.env, NO_COLOR: '1' }
      });
      this.child = child;
      let out = '', err = '', settled = false;
      const finish = (e, v) => { if (settled) return; settled = true; this.child = null; clearTimeout(timer); signal?.removeEventListener('abort', abort); e ? reject(e) : resolve(v); };
      const abort = () => { child.kill(); finish(new Hold('停止しました。', 'STOPPED')); };
      // OAuth is a human handoff; keep the CLI alive long enough for browser login.
      // Engine still enforces the normal task/session limits after authentication.
      const timer = setTimeout(() => { child.kill(); finish(new Hold('認証の制限時間に達しました。', 'WAITING_HUMAN')); }, 900000);
      signal?.addEventListener('abort', abort, { once: true });
      const read = (data, isErr) => {
        const text = data.toString(); if (isErr) err += text; else out += text;
        const auth = extractOAuthUrl(out + err);
        if (auth && !this.login.url) { this.login = { state:'WAITING_HUMAN', message:'Google OAuthをブラウザで開き、認証コードをCLIへ戻してください。', url:auth }; }
        if (Buffer.byteLength(out + err) > 120000) { child.kill(); finish(new Hold('Worker応答が大きすぎます。')); }
      };
      child.onData(data => read(data, false));
      child.onExit(({ exitCode }) => {
        if (settled) return;
        this.diagnostic = { ...this.diagnostic, stdoutBytes:Buffer.byteLength(out), stderrBytes:Buffer.byteLength(err), exitCode };
        if (exitCode !== 0) return finish(new Hold(this.login.url ? 'Google OAuthの本人操作を完了してください。' : 'Antigravity CLI接続に失敗しました。', 'WAITING_HUMAN'));
        try {
          const parsed = parseCliResponse(out); const response = parsed.response ?? parsed.text ?? parsed.result;
          if (typeof response !== 'string' || !response.trim()) throw Error();
          this.diagnostic = { ...this.diagnostic, responseType:typeof response, responseBytes:Buffer.byteLength(response) };
          finish(null, { response, stats: parsed.stats ?? {} });
        } catch { this.diagnostic = { ...this.diagnostic, holdReason:'invalid_response_format' }; finish(new Hold('Antigravityの応答形式を確認できません。')); }
      });
    });
  }
  submitAuthCode(code) {
    if (!this.child) throw new Hold('認証セッションが期限切れです。「Googleで接続する」から再開してください。', 'WAITING_HUMAN');
    if (!/^[A-Za-z0-9._~\-\/+=]{4,2048}$/.test(String(code ?? ''))) throw new Hold('認証コードを入力してください。', 'WAITING_HUMAN');
    this.codeSubmitted = true;
    this.child.write(String(code).trim() + '\r');
    return true;
  }
  async connect() {
    try {
      const result = await this.run('Reply exactly READY. Do not use tools or edit files.', undefined);
      if (result.response.trim() !== 'READY') throw new Hold('接続確認の応答が一致しません。');
      this.ready = true; this.login = { state:'IDLE', message:'Antigravity CLI接続済み。' };
    } catch (e) { this.login = { state:(this.codeSubmitted ? 'ERROR' : (e.state ?? 'ERROR')), message:e.message }; }
  }
  async propose(request, signal) {
    if (!this.ready) throw new Hold('Google OAuthの本人認証を行ってください。', 'WAITING_HUMAN');
    const prompt = [
      'For a clear safe task, return a Candidate JSON. Use hold only when safety or genuine ambiguity prevents a safe change.',
      'KADP Independent ProtoのCandidate-only Workerです。ツールを使わず、JSONだけ返してください。',
      '形式: {"summary":"日本語説明","files":[{"path":"app/result.js","content":"完全なファイル内容"}]}。曖昧なら {"hold":"理由"}。TESTやGitを実行したとは言わない。',
      '変更可能範囲はapp/*.jsとNEW cases/*.jsonだけ。core/ui/既存cases/Constitutionは保護対象。',
      '処理系はQuickJSでホストAPIなし。', JSON.stringify(request)
    ].join('\n');
    const result = await this.run(prompt, signal); let text = result.response.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    if (privateText(text)) { this.diagnostic = { ...this.diagnostic, holdReason:'private_text' }; throw new Hold('Worker出力に秘密情報の疑いがあります。'); }
    let candidate; try { candidate = JSON.parse(text); } catch { this.diagnostic = { ...this.diagnostic, holdReason:'candidate_json_parse' }; throw new Hold('検査可能なCandidate JSONではありません。'); }
    if (candidate.hold) { this.diagnostic = { ...this.diagnostic, holdReason:'worker_requested_hold' }; throw new Hold('Workerが保留しました。', 'WAITING_HUMAN'); }
    return { candidate, evidence:{worker:ANTIGRAVITY_WORKER_ID, promptHash:sha(prompt), responseHash:sha(text), stats:result.stats} };
  }
}
