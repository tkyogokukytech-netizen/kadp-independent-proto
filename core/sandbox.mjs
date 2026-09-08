import { getQuickJS } from 'quickjs-emscripten';
import fs from 'node:fs';
import { safePath, Hold } from './safety.mjs';

export async function invoke(root, fn, input) {
  if (!['formatResult', 'plan'].includes(fn)) throw new Hold('未定義の機能です。');
  const files = fs.readdirSync(safePath(root, 'app')).filter(n => /^[a-z][a-z0-9_-]*\.js$/.test(n)).sort();
  const source = files.map(n => fs.readFileSync(safePath(root, 'app/' + n), 'utf8')).join('\n');
  const QuickJS = await getQuickJS(); const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(8 * 1024 * 1024); runtime.setMaxStackSize(256 * 1024);
  const deadline = Date.now() + 150; runtime.setInterruptHandler(() => Date.now() > deadline);
  const vm = runtime.newContext();
  try {
    const result = vm.evalCode(source + '\nJSON.stringify(' + fn + '(' + JSON.stringify(input) + '));');
    if (result.error) { result.error.dispose(); throw new Hold('隔離コードの実行に失敗しました。'); }
    try {
      const encoded = vm.getString(result.value);
      if (encoded.length > 20000) throw new Hold('実行結果が大きすぎます。');
      return JSON.parse(encoded);
    } finally { result.value.dispose(); }
  } finally { vm.dispose(); runtime.dispose(); }
}
