import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const LIMITS = Object.freeze({ attempts: 2, sameFailure: 2, taskMs: 1800000, sessionMs: 43200000, tasks: 6, bytes: 100000 });
export class Hold extends Error { constructor(message, state = 'HOLD') { super(message); this.state = state; } }
export const sha = value => crypto.createHash('sha256').update(value).digest('hex');
export function privateText(text) {
  return /(?:AIza[\w-]{25,}|sk-[\w-]{16,}|gh[pousr]_[\w]{15,}|-----BEGIN .*PRIVATE KEY|(?:password|api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*["']?[^\s"']{6,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{3}[- ]\d{4}[- ]\d{4}\b)/i.test(text);
}
export function inspectTask(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 4000) throw new Hold('作業を短い文章で入力してください。', 'WAITING_HUMAN');
  if (privateText(text)) throw new Hold('秘密情報または個人情報の可能性があるため、保存・送信しません。取り除いて入力してください。', 'WAITING_HUMAN');
  if (/PROD|本番|Money\s*Forward|マネーフォワード|送信|メール|LINE|SNS|購入|予約|契約|課金|支払|送金|削除|認証.*変更|権限.*変更/i.test(text)) throw new Hold('この作業は現在の安全な自己開発範囲を超えています。', 'WAITING_HUMAN');
  if (/(Safety\s*Kernel|Constitution|protected|保護.*(?:ファイル|テスト)|安全規則).*(変更|修正|解除|弱|書換)/i.test(text)) throw new Hold('安全基盤の変更には別途人間の判断が必要です。ここでは適用できません。', 'WAITING_HUMAN');
  return text.trim();
}
export function safePath(root, relative) {
  if (typeof relative !== 'string' || !relative || /[\\:%\x00-\x1f]/.test(relative) || path.isAbsolute(relative)) throw new Hold('不正なパスを拒否しました。');
  const parts = relative.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p))) throw new Hold('領域外パスを拒否しました。');
  let current = path.resolve(root);
  for (const part of [null, ...parts]) {
    if (part) current = path.join(current, part);
    if (fs.existsSync(current)) {
      const s = fs.lstatSync(current);
      if (s.isSymbolicLink() || (s.isFile() && s.nlink !== 1)) throw new Hold('リンク経由のアクセスを拒否しました。');
      const real = fs.realpathSync(current);
      if (real.toLowerCase() !== current.toLowerCase()) throw new Hold('実体パスの不一致を拒否しました。');
    }
  }
  return current;
}
export function mutable(relative) {
  return /^app\/[a-z][a-z0-9_-]*\.js$/.test(relative) || /^cases\/[a-z][a-z0-9_-]*\.json$/.test(relative);
}
export function validateCandidate(root, candidate, existingCases = []) {
  if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.files) || !candidate.files.length || candidate.files.length > 8 || typeof candidate.summary !== 'string') throw new Hold('変更案の形式が確認できません。');
  if (privateText(JSON.stringify(candidate))) throw new Hold('変更案に秘密情報・個人情報の疑いがあります。保存しません。');
  let size = 0; const names = new Set();
  for (const file of candidate.files) {
    safePath(root, file.path);
    if (!mutable(file.path)) throw new Hold('保護対象または許可範囲外の変更を拒否しました。', 'WAITING_HUMAN');
    if (names.has(file.path) || typeof file.content !== 'string') throw new Hold('変更案が不正です。');
    names.add(file.path); size += Buffer.byteLength(file.content);
    if (existingCases.includes(file.path)) throw new Hold('既存の受入TESTは自己変更できません。', 'WAITING_HUMAN');
    if (file.path.endsWith('.js') && /\b(import|require|fetch|process|WebAssembly|XMLHttpRequest|eval)\b|https?:\/\/|child_process/.test(file.content)) throw new Hold('外部機能または動的コード実行を含む変更案を拒否しました。');
    if (file.path.endsWith('.json')) {
      let c; try { c = JSON.parse(file.content); } catch { throw new Hold('TEST形式が不正です。'); }
      if (!Array.isArray(c) || !c.length || c.length > 30) throw new Hold('TEST形式が不正です。');
      for (const t of c) if (!['formatResult', 'plan'].includes(t.fn) || !['equals', 'includes'].includes(t.op) || !Object.hasOwn(t, 'expected') || !Object.hasOwn(t, 'input')) throw new Hold('TESTの検査方法が不正です。');
    }
  }
  if (size > LIMITS.bytes) throw new Hold('変更案が大きすぎます。');
  return candidate;
}
export function acquireLock(root) {
  const file = safePath(root, '.runtime/task.lock');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let fd; try { fd = fs.openSync(file, 'wx'); } catch { throw new Hold('前の実行のロックがあります。自動解除せず安全に停止します。', 'WAITING_HUMAN'); }
  const token = crypto.randomUUID(); fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token, at: new Date().toISOString() })); fs.closeSync(fd);
  return () => { if (JSON.parse(fs.readFileSync(file, 'utf8')).token === token) fs.unlinkSync(file); };
}
