// Unprivileged task-selection logic.
// plan receives { tasks: [{id, text, status, dependencies}], elapsedMs }.
// It may only propose the next task. The protected host rechecks the result.
function plan(session) {
  const tasks = Array.isArray(session?.tasks) ? session.tasks : [];

  const next = tasks.find(task =>
    task.status === 'READY' &&
    Array.isArray(task.dependencies) &&
    task.dependencies.every(id =>
      tasks.find(dep => dep.id === id)?.status === 'COMPLETED'
    )
  );

  return next
    ? { action: 'run', id: next.id }
    : { action: 'stop' };
}
