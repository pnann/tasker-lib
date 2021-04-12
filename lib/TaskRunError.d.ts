import { TaskErrorMap } from "./TaskErrorMap";
/**
 * The top-level error that is emitted on a failed call to `TaskRunner.run`. Includes a map of all failed tasks to their
 * associated Error.
 */
declare class TaskRunError extends Error {
    failedTaskMap: TaskErrorMap;
    constructor(failedTasks: TaskErrorMap);
}
export { TaskRunError };
