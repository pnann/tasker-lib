declare module "tasker-lib" {

    type TaskResult = { [taskName: string]: any };

    interface AsyncTask<T> {
        (results?: TaskResult, done?: (result: T) => void): void;
    }

    interface SyncTask<T> {
        (results?: TaskResult): T;
    }

    interface PromiseTask<T> {
        (results?: TaskResult): Promise<T>;
    }

    type Task<T> = SyncTask<T> | AsyncTask<T> | PromiseTask<T>;

    /**
     * A set of options which can optionally be passed into a new TaskRunner.
     */
    interface Options {
        onTaskStart?: (taskName: string) => void;
        onTaskEnd?: (taskName: string) => void;
        throwOnOverwrite?: boolean;
    }

    /**
     * A basic task runner with support for asynchronous tasks. To use, create a task tree before selecting a task to run
     * by name. The task as well as any and all dependent tasks will be asynchronously executed. Tasks can consume the results
     * of their dependencies.
     *
     * Cycles are not supported and will result in an error being thrown.
     *
     * The task tree cannot be modified while task execution is in progress. Attempting to do so will result in an error
     * being thrown.
     *
     * Adding a task that already exists with the same name will result in an error being thrown unless throwOnOverwrite is
     * set to false.
     *
     * Supports the following task types:
     *  - Synchronous tasks.
     *  - Promise tasks.
     *  - "done" callback for asynchronous tasks.
     *
     * Refer to README.md for examples.
     */
    class TaskRunner {

        /**
         * Creates a new TaskRunner with optional onTaskStart and onTaskEnd callbacks.
         *
         * @param {Options} options An optional object containing various configurable options.
         */
        constructor(options?: Options);

        /**
         * Add a task to the task tree with an optional set of dependencies.
         *
         * Adding a task that already exists with the same name will result in an error being thrown unless the TaskRunner
         * is created with the option "throwOnOverwrite" set to false.
         *
         * Tasks are functions that can have up to two parameters:
         *  - results?: TaskResult - A map of task names to their associated results. Used to consume results of dependent
         *                           tasks.
         *  - done?: (result: T) => void - If defined, this function *must* be called to trigger task completion.
         *
         * @param {string} taskName -  The unique name for this task.
         * @param {string | string[]} [dependencies] - An optional list of dependencies needed before this task can be executed.
         * These do not need to exist when adding this task, but do need to exist when running the task later.
         * @param {(results?: TaskResult, done?: (result: any) => void)} task - A function to execute for this task. May be
         * a synchronous function (regular return value), promise function (return a promise), or other asynchronous
         * function (return nothing, call "done" when complete).
         */
        addTask<T>(taskName: string, dependencies: string | string[] | Task<T>, task?: Task<T>);

        /**
         * Removes a given task from the task tree. This will result in the task no longer existing, but will *not* affect
         * any tasks that may depend on it.
         *
         * @param {string} taskName - The unique name of the task to remove. Does nothing if the task does not exist.
         */
        removeTask(taskName: string);

        /**
         * Adds one or more new dependencies to the given parent task. The parent task must exist when adding dependencies,
         * but the dependent tasks do not need to exist until run is called. This does nothing if the task-dependency link
         * is already in place.
         *
         * Throws an error if the parent task does not exist.
         *
         * @param {string} taskName - The unique name of the task to add dependencies to.
         * @param {(string | string[])} dependencies - One or more dependencies to add to the given task.
         */
        addDependencies(taskName: string, dependencies: string | string[]);

        /**
         * Removes one or more dependencies from the given task. This will not remove the dependent tasks themselves, but
         * only the dependency link. This does nothing if the task does not exist or if there is no dependency link in
         * place.
         *
         * @param {string} taskName - The unique name of the task to remove dependencies from.
         * @param {(string | string[])} dependencies - One ore more dependencies to remove from the given task.
         */
        removeDependencies(taskName: string, dependencies: string | string[]);

        /**
         * Returns a list of all tasks and their associated dependencies.
         *
         * @returns {{taskName: string}: string[]}
         */
        getTaskList(): { [taskName: string]: string[] };

        /**
         * Run the given task and any dependencies that it requires. Returns a promise which will be resolved when the task
         * is completed.
         *
         * Rejects the promise if no tasks exist with the given name, or a task is found with a non-existent dependency.
         *
         * Rejects the promise if there is a cycle in the task tree.
         *
         * @param {string} taskName - The unique name of the task to run.
         * @returns {Promise<T>} - A promise that resolves when the task has completed.
         */
        run<T>(taskName: string): Promise<T>;
    }
}
