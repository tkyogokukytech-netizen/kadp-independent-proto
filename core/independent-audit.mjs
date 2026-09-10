const HIGH_RISK = /(?:PROD|本番|外部(?:送信|POST|書き込み)|金銭|請求|Money\s*Forward|secret|token|OAuth|憲法|CONSTITUTION|Safety Kernel|protected)/i;

function result(id, pass, detail) {
  return { id, pass, detail };
}

function textOf(value) {
  return typeof value === 'string' ? value : '';
}

function meaningfulTokens(text) {
  return [...new Set(textOf(text).toLowerCase().match(/[a-z0-9_]{3,}|[一-龯々]{2,}/g) ?? [])]
    .filter(token => !['して', 'する', 'ください', '改善', '変更', '結果', '内容'].includes(token));
}

/**
 * Deterministic, read-only review of a tested Candidate.
 * This module deliberately has no filesystem, Git, network, or provider access.
 * It is intended to run as an independent reviewer beside the Worker.
 */
export function independentlyAudit({
  request,
  candidate,
  tests,
  baseline,
  changedPaths = [],
  allowedPaths = ['app/*.js', 'cases/*.json']
} = {}) {
  const requestText = textOf(request);
  const summary = textOf(candidate?.summary);
  const files = Array.isArray(candidate?.files) ? candidate.files : [];
  const paths = files.map(file => textOf(file?.path)).filter(Boolean);
  const uniquePaths = new Set(paths);
  const declaredPaths = new Set(changedPaths.filter(path => typeof path === 'string'));
  const checks = [];

  checks.push(result(
    'request-present',
    requestText.trim().length > 0,
    requestText.trim() ? '依頼文を確認しました。' : '依頼文がありません。'
  ));
  checks.push(result(
    'candidate-present',
    files.length > 0 && Boolean(summary.trim()),
    files.length > 0 && summary.trim() ? '変更概要と変更ファイルがあります。' : '変更概要または変更ファイルがありません。'
  ));
  const requestTokens = meaningfulTokens(requestText);
  const candidateText = [summary, ...files.map(file => textOf(file?.content)), ...paths].join(' ').toLowerCase();
  const aligned = requestTokens.length === 0 || requestTokens.some(token => candidateText.includes(token));
  checks.push(result(
    'request-alignment',
    aligned,
    aligned ? '依頼内容とCandidateの説明に共通する要素があります。' : '依頼内容とCandidateの説明が噛み合っていません。'
  ));
  checks.push(result(
    'tests-pass',
    tests?.pass === true,
    tests?.pass === true ? `TESTは${tests.passed ?? 0}/${tests.total ?? 0} PASSです。` : 'TESTが成功していません。'
  ));
  checks.push(result(
    'baseline-present',
    typeof baseline === 'string' && /^[0-9a-f]{7,64}$/i.test(baseline),
    typeof baseline === 'string' && /^[0-9a-f]{7,64}$/i.test(baseline) ? '基準commitを確認しました。' : '基準commitが確認できません。'
  ));
  checks.push(result(
    'no-duplicate-paths',
    uniquePaths.size === paths.length,
    uniquePaths.size === paths.length ? '変更ファイルの重複はありません。' : '同じ変更ファイルが重複しています。'
  ));
  checks.push(result(
    'declared-paths-match',
    declaredPaths.size === 0 || paths.every(path => declaredPaths.has(path)),
    declaredPaths.size === 0 || paths.every(path => declaredPaths.has(path)) ? '変更ファイルの申告が一致しています。' : 'Candidateと申告された変更ファイルが一致しません。'
  ));
  checks.push(result(
    'safe-scope',
    paths.every(path => allowedPaths.some(pattern => {
      if (pattern.endsWith('*.js')) return path.startsWith(pattern.slice(0, -4)) && path.endsWith('.js');
      if (pattern.endsWith('*.json')) return path.startsWith(pattern.slice(0, -5)) && path.endsWith('.json');
      return path === pattern;
    })),
    paths.every(path => allowedPaths.some(pattern => {
      if (pattern.endsWith('*.js')) return path.startsWith(pattern.slice(0, -4)) && path.endsWith('.js');
      if (pattern.endsWith('*.json')) return path.startsWith(pattern.slice(0, -5)) && path.endsWith('.json');
      return path === pattern;
    })) ? '許可されたTEST範囲内です。' : '許可範囲外のファイルが含まれています。'
  ));
  const joined = [requestText, summary, ...files.map(file => textOf(file?.content))].join('\n');
  checks.push(result(
    'no-high-risk-scope',
    !HIGH_RISK.test(joined),
    HIGH_RISK.test(joined) ? '高リスク語句を検出しました。人間確認が必要です。' : 'PROD・外部送信・金銭処理等の高リスク語句は検出されませんでした。'
  ));

  const passed = checks.every(check => check.pass);
  return {
    passed,
    decision: passed ? 'PASS' : 'HUMAN_REQUIRED',
    reviewer: 'CHATGPT_INDEPENDENT_AUDITOR',
    checks,
    summary: passed ? '独立監査を通過しました。人間承認前の確認を完了しました。' : '独立監査で確認が必要な項目があります。人間承認まで進めません。'
  };
}
