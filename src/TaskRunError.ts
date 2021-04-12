import { TaskErrorMap } from "./TaskErrorMap";

/**
 * The top-level error that is emitted on a failed call to `TaskRunner.run`. Includes a map of all failed tasks to their
 * associated Error.
 */
class TaskRunError extends Error {
    public failedTaskMap: TaskErrorMap;

    constructor(failedTasks: TaskErrorMap) {
        super();
        this.failedTaskMap = failedTasks;
    }
}

export {TaskRunError};
