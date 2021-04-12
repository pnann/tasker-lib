/**
 * An object that maps a task to its result. Used to get the results for task dependencies.
 */
declare type TaskResultMap = {
    [taskName: string]: any;
};
export { TaskResultMap };
