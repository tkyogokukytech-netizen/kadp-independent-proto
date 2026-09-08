// Pure presentation logic. No host capabilities are available here.
function formatResult(result) {
  var message = result.ok ? '作業が完了しました。' : '作業を保留しました。';
  if (result && typeof result.durationMs === 'number') {
    message += ' (処理時間: ' + result.durationMs + 'ms)';
  }
  return message;
}
