// Pure presentation logic. No host capabilities are available here.
function formatResult(result) {
  if (!result) {
    return '作業を保留しました。';
  }
  var message = result.ok ? '作業が完了しました。' : '作業を保留しました。';
  var duration = typeof result.durationMs === 'number'
    ? result.durationMs
    : typeof result.elapsedMs === 'number'
      ? result.elapsedMs
      : null;
  if (duration !== null) {
    message += ' (処理時間: ' + duration + 'ms)';
  }
  return message;
}
