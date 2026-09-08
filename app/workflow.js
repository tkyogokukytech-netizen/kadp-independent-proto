// The initial Proto has no unattended task-selection implementation.
// plan receives { tasks: [{id, text, status, dependencies}], elapsedMs }.
// It may return {action:'run', id:<READY task id>} or {action:'stop'}.
// The protected host always rechecks dependencies, safety and resource limits.
function plan(session) {
  return { action: 'stop' };
}
