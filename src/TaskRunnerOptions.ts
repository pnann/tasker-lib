/**
 * Options to be used to configure a TaskRunner.
 */
interface Options {

    /**
     * An optional callback which will be fired before each task is executed.
     *
     * @param taskName
     */
    onTaskStart?: (taskName: string, taskDependencies: string[]) => void;

    /**
     * An optional callback which will be fired after each task has finished execution.
     *
     * @param taskName
     * @param totalTaskTimeMs the total time in milliseconds taken to execute the task
     */
    onTaskEnd?: (taskName: string, totalTaskTimeMs: number) => void;

    /**
     * An optional callback which will be fired after a task has failed.
     *
     * @param taskName
     * @param error the Error that caused the task to fail
     */
    onTaskFail?: (taskName: string, error: Error) => void;

    /**
     * An optional callback which will be fired after each task has been cancelled. A task will be cancelled if a 
     * depenendent task fails, preventing it from running.
     *
     * @param taskName
     */
    onTaskCancel?: (taskName: string) => void;

    /**
     * By default, adding a task that already exists with the same name will result in an error being thrown unless
     * throwOnOverwrite is set to false.
     */
    throwOnOverwrite?: boolean;
}

export { Options };
