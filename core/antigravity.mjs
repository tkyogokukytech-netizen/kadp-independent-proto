import { spawn } from 'node:child_process';
import path from 'node:path';
import { Hold, LIMITS, privateText, sha } from './safety.mjs';

// Provider adapter. Engine/Worker Interface stays provider-neutral: only this file knows agy flags.
export const ANTIGRAVITY_WORKER_ID = 'official-antigravity-cli';
export class AntigravityWorker {
  constructor(root, executable = path.join(process.env.LOCALAPPDATA ?? '', 'agy', 'bin', 'agy.exe')) {
    this.root = root; this.executable = executable; this.ready = false;
    this.login = { state: 'WAITING_HUMAN', message: 'Google OAuthの本人認証が必要です。' };
  }
  run(prompt, signal) {
    if (privateText(prompt)) return Promise.reject(new Hold('送信前検査で秘密情報の可能性を検出しました。', 'WAITING_HUMAN'));
    return new Promise((resolve, reject) => {
      const child = spawn(this.executable, ['--mode', 'plan', '--output-format', 'json', '--print-timeout', '180s', '--print=' + prompt], {
        cwd: path.join(this.root, '.private', 'worker-workspace'), windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      this.child = child;
      let out = '', err = '', settled = false;
      const finish = (e, v) => { if (settled) return; settled = true; this.child = null; clearTimeout(timer); signal?.removeEventListener('abort', abort); e ? reject(e) : resolve(v); };
      const abort = () => { child.kill(); finish(new Hold('停止しました。', 'STOPPED')); };
      const timer = setTimeout(() => { child.kill(); finish(new Hold('Workerの制限時間に達しました。')); }, LIMITS.taskMs);
      signal?.addEventListener('abort', abort, { once: true });
      const read = (data, isErr) => {
        const text = data.toString(); if (isErr) err += text; else out += text;
        const auth = (out + err).match(/https:\/\/accounts\.google\.com\/[^\s]+/);
        if (auth && !this.login.url) { this.login = { state:'WAITING_HUMAN', message:'Google OAuthをブラウザで開き、認証コードをCLIへ戻してください。', url:auth[0] }; }
        if (Buffer.byteLength(out + err) > 120000) { child.kill(); finish(new Hold('Worker応答が大きすぎます。')); }
      };
      child.stdout.on('data', d => read(d, false)); child.stderr.on('data', d => read(d, true)); child.stdin.on('error', () => {});
      child.on('error', () => finish(new Hold('Antigravity CLIを起動できません。', 'WAITING_HUMAN')));
      child.on('close', code => {
        if (settled) return;
        if (code !== 0) return finish(new Hold(this.login.url ? 'Google OAuthの本人操作を完了してください。' : 'Antigravity CLI接続に失敗しました。', 'WAITING_HUMAN'));
        try {
          const parsed = JSON.parse(out.trim()); const response = parsed.response ?? parsed.text ?? parsed.result;
          if (typeof response !== 'string' || !response.trim()) throw Error();
          finish(null, { response, stats: parsed.stats ?? {} });
        } catch { finish(new Hold('Antigravityの応答形式を確認できません。')); }
      });
    });
  }
  submitAuthCode(code) {
    if (!this.child || !/^[A-Za-z0-9._~\-\/+=]{4,2048}$/.test(String(code ?? ''))) throw new Hold('認証コードを入力してください。', 'WAITING_HUMAN');
    this.child.stdin.write(String(code).trim() + '\n');
    return true;
  }
  async connect() {
    try {
      const result = await this.run('Reply exactly READY. Do not use tools or edit files.', undefined);
      if (result.response.trim() !== 'READY') throw new Hold('接続確認の応答が一致しません。');
      this.ready = true; this.login = { state:'IDLE', message:'Antigravity CLI接続済み。' };
    } catch (e) { this.login = { ...this.login, state:e.state ?? 'ERROR', message:e.message }; }
  }
  async propose(request, signal) {
    if (!this.ready) throw new Hold('Google OAuthの本人認証を行ってください。', 'WAITING_HUMAN');
    const prompt = [
      'KADP Independent ProtoのCandidate-only Workerです。ツールを使わず、JSONだけ返してください。',
      '形式: {"summary":"日本語説明","files":[{"path":"app/result.js","content":"完全なファイル内容"}]}。曖昧なら {"hold":"理由"}。TESTやGitを実行したとは言わない。',
      '変更可能範囲はapp/*.jsとNEW cases/*.jsonだけ。core/ui/既存cases/Constitutionは保護対象。',
      '処理系はQuickJSでホストAPIなし。', JSON.stringify(request)
    ].join('\n');
    const result = await this.run(prompt, signal); let text = result.response.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    if (privateText(text)) throw new Hold('Worker出力に秘密情報の疑いがあります。');
    let candidate; try { candidate = JSON.parse(text); } catch { throw new Hold('検査可能なCandidate JSONではありません。'); }
    if (candidate.hold) throw new Hold('Workerが保留しました。', 'WAITING_HUMAN');
    return { candidate, evidence:{worker:ANTIGRAVITY_WORKER_ID, promptHash:sha(prompt), responseHash:sha(text), stats:result.stats} };
  }
}
