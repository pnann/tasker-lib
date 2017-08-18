/**
 * Options to be used to configure a TaskRunner.
 */
interface Options {

    /**
     * An optional callback which will be fired before each task is executed.
     *
     * @param {string} taskName
     */
    onTaskStart?: (taskName: string) => void;

    /**
     * An optional callback which will be fired after each task has finished execution.
     *
     * @param {string} taskName
     */
    onTaskEnd?: (taskName: string) => void;

    /**
     * By default, adding a task that already exists with the same name will result in an error being thrown unless
     * throwOnOverwrite is set to false.
     */
    throwOnOverwrite?: boolean;
}

export {Options}