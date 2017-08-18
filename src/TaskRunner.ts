import {Promisifier} from "./Promisifier";
import {Task} from "./Task";
import {TaskResult} from "./TaskResult";
import {Options} from "./TaskRunnerOptions";

interface TaskInfo {
    taskName: string,
    dependencies: string[],
    task: (depResults: TaskResult) => any,
    promise?: Promise<TaskResult>,
    visited?: boolean
}

const DEFAULT_OPTIONS: Options = {
    throwOnOverwrite: true
};

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
    private promisifier: Promisifier;
    private options: Options;

    private taskMap: { [taskName: string]: TaskInfo } = {};
    private execInProgress = false;

    /**
     * Creates a new TaskRunner with optional options.
     *
     * @param {Options} options An optional object containing various configurable options.
     * @param {Promisifier} promisifier An override for the Promisifier. Only for unit testing.
     */
    constructor(options: Options = DEFAULT_OPTIONS, promisifier = new Promisifier()) {
        this.options = options;
        this.promisifier = promisifier;
    }

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
    addTask<T>(taskName: string, dependencies: string | string[] | Task<T>, task?: Task<T>) {
        this.throwIfInProgress();

        if (this.options.throwOnOverwrite && this.taskMap[taskName]) {
            throw new Error(`Task ${taskName} already exists.`);
        }

        if (typeof dependencies === "function") {
            task = dependencies;
            dependencies = [];
        } else if (typeof dependencies === "string") {
            dependencies = [dependencies];
        }

        this.taskMap[taskName] = {
            taskName: taskName,
            dependencies: dependencies,
            task: this.promisifier.wrap(task)
        };
    }

    /**
     * Removes a given task from the task tree. This will result in the task no longer existing, but will *not* affect
     * any tasks that may depend on it.
     *
     * @param {string} taskName - The unique name of the task to remove. Does nothing if the task does not exist.
     */
    removeTask(taskName: string) {
        this.throwIfInProgress();

        delete this.taskMap[taskName];
    }

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
    addDependencies(taskName: string, dependencies: string | string[]) {
        this.throwIfInProgress();

        const task = this.taskMap[taskName];
        if (task) {
            if (typeof dependencies === "string") {
                dependencies = [dependencies];
            }

            for (const dependency of dependencies) {
                if (task.dependencies.indexOf(dependency) === -1) {
                    task.dependencies.push(dependency);
                }
            }
        } else {
            throw new Error(`Can't add dependency for missing task ${taskName}`);
        }
    }

    /**
     * Removes one or more dependencies from the given task. This will not remove the dependent tasks themselves, but
     * only the dependency link. This does nothing if the task does not exist or if there is no dependency link in
     * place.
     *
     * @param {string} taskName - The unique name of the task to remove dependencies from.
     * @param {(string | string[])} dependencies - One ore more dependencies to remove from the given task.
     */
    removeDependencies(taskName: string, dependencies: string | string[]) {
        this.throwIfInProgress();

        const task = this.taskMap[taskName];
        if (task) {
            if (typeof dependencies === "string") {
                dependencies = [dependencies];
            }

            task.dependencies = task.dependencies.filter((dependency) => {
                return dependencies.indexOf(dependency) === -1;
            });
        }
    }

    /**
     * Returns a list of all tasks and their associated dependencies.
     *
     * @returns {{taskName: string}: string[]}
     */
    getTaskList(): { [taskName: string]: string[] } {
        const map = {};
        for (const taskName in this.taskMap) {
            /* istanbul ignore else */
            if (this.taskMap.hasOwnProperty(taskName)) {
                map[taskName] = this.taskMap[taskName].dependencies;
            }
        }

        return map;
    }

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
    run<T>(taskName: string): Promise<T> {
        this.throwIfInProgress();

        this.execInProgress = true;
        return this.runTask(taskName)
            .then((results) => results ? results[taskName] : null)
            .then((results) => {
                this.execInProgress = false;
                return results;
            })
            .catch((error) => {
                this.execInProgress = false;
                throw error;
            });
    }

    private runTask(taskName: string): Promise<TaskResult> {
        const task = this.taskMap[taskName];
        if (task) {
            if (task.visited) {
                return Promise.reject(new Error(`Cycle found at '${taskName}'`));
            }

            if (task.promise) {
                return task.promise;
            }

            if (this.options.onTaskStart) {
                this.options.onTaskStart(taskName);
            }

            task.visited = true;
            if (task.dependencies && task.dependencies.length > 0) {
                task.promise = Promise.all(task.dependencies.map((dependency) => this.runTask(dependency)))
                    .then((results: TaskResult[]) => {
                        const mergedResults = {};
                        for (const result of results) {
                            for (const taskName in result) {
                                /* istanbul ignore else */
                                if (this.taskMap.hasOwnProperty(taskName)) {
                                    mergedResults[taskName] = result[taskName];
                                }
                            }
                        }

                        return mergedResults;
                    })
                    .then((previousResults) => task.task(previousResults));
            } else {
                task.promise = task.task({})
                    .then((result) => {
                        return {
                            [taskName]: result
                        };
                    });
            }
            task.visited = false;

            return task.promise.then((result) => {
                if (this.options.onTaskEnd) {
                    this.options.onTaskEnd(taskName);
                }

                task.promise = null;
                return result;
            });
        } else {
            return Promise.reject(new Error(`Task '${taskName}' not found`));
        }
    }

    private throwIfInProgress() {
        if (this.execInProgress) {
            throw new Error(`You cannot modify the task tree while execution is in progress.`);
        }
    }
}

export {TaskRunner};
