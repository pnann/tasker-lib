/**
 * An object that maps a task to its error. Used to get the results for task dependencies.
 */
type TaskErrorMap = { [taskName: string]: Error };

export { TaskErrorMap };
