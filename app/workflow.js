// Unprivileged task-selection logic.
// plan receives { tasks: [{id, text, status, dependencies}], elapsedMs }.
// It may only propose the next task. The protected host rechecks the result.
function plan(session) {
  const elapsedMs = session?.elapsedMs;
  if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return { action: 'stop' };
  }

  const tasks = Array.isArray(session?.tasks) ? session.tasks : [];
  if (tasks.length === 0) {
    return { action: 'stop' };
  }

  const next = tasks.find(task =>
    Boolean(task) &&
    typeof task === 'object' &&
    typeof task.id === 'string' &&
    task.id.trim() !== '' &&
    task.status === 'READY' &&
    Array.isArray(task.dependencies) &&
    task.dependencies.every(id =>
      tasks.find(dep => Boolean(dep) && typeof dep === 'object' && dep.id === id)?.status === 'COMPLETED'
    )
  );

  return next
    ? { action: 'run', id: next.id }
    : { action: 'stop' };
}
