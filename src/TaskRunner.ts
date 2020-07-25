import { Promisifier } from "./Promisifier";
import { Task } from "./Task";
import { TaskResult } from "./TaskResult";
import { Options } from "./TaskRunnerOptions";

interface TaskInfo<T extends TaskResult> {
    taskName: string,
    dependencies: string[],
    promise: Promise<TaskResult> | null,
    task: (depResults: T) => Promise<TaskResult>,
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

    private taskMap: { [taskName: string]: TaskInfo<any> } = {};
    private execInProgress = false;

    /**
     * Creates a new TaskRunner
     *
     * @param options An optional object containing various configurable options.
     */
    constructor(options?: Options);

    /**
     * @internal
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
     * @param taskName -  The unique name for this task.
     * @param dependencies - An optional list of dependencies needed before this task can be executed.
     * These do not need to exist when adding this task, but do need to exist when running the task later.
     * @param task - A function to execute for this task. May be a synchronous function (regular return value), promise function (return a promise), or other
     * asynchronous function (return nothing, call "done" when complete).
     */
    addTask<T>(taskName: string, dependencies?: string | string[] | Task<T>, task?: Task<T>): void {
        if (taskName === null || taskName === undefined) {
            throw new Error("Missing task name");
        }
        this.throwIfInProgress();

        if (this.options.throwOnOverwrite && this.taskMap[taskName]) {
            throw new Error(`Task ${taskName} already exists.`);
        }

        if (typeof dependencies === "function") {
            task = dependencies;
            dependencies = [];
        } else if (typeof dependencies === "string") {
            dependencies = [dependencies];
        } else if (!dependencies) {
            dependencies = [];
        }

        this.taskMap[taskName] = {
            taskName: taskName,
            dependencies: dependencies,
            promise: null,
            task: task ? this.promisifier.wrap(task) : () => Promise.resolve({})
        };
    }

    /**
     * Removes a given task from the task tree. This will result in the task no longer existing, but will *not* affect
     * any tasks that may depend on it.
     *
     * @param taskName - The unique name of the task to remove. Does nothing if the task does not exist.
     */
    removeTask(taskName: string): void {
        if (taskName === null || taskName === undefined) {
            throw new Error("Missing task name");
        }
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
     * @param taskName - The unique name of the task to add dependencies to.
     * @param dependencies - One or more dependencies to add to the given task.
     */
    addDependencies(taskName: string, dependencies: string | string[]): void {
        if (taskName === null || taskName === undefined) {
            throw new Error("Missing task name");
        }
        if (dependencies === null || dependencies === undefined) {
            throw new Error("Missing dependencies");
        }
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
     * @param taskName - The unique name of the task to remove dependencies from.
     * @param dependencies - One ore more dependencies to remove from the given task.
     */
    removeDependencies(taskName: string, dependencies: string | string[]): void {
        if (taskName === null || taskName === undefined) {
            throw new Error("Missing task name");
        }
        if (dependencies === null || dependencies === undefined) {
            throw new Error("Missing dependencies");
        }
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
     */
    getTaskList(): { [taskName: string]: string[] } {
        const map: { [taskName: string]: string[]} = {};
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
     * @param taskName - The unique name of the task to run.
     * @returns A promise that resolves when the task has completed.
     */
    run<T>(taskName: string): Promise<T> {
        if (taskName === null || taskName === undefined) {
            return Promise.reject(new Error("Missing task name"));
        }
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
                this.options.onTaskStart(taskName, task.dependencies);
            }

            task.visited = true;
            if (task.dependencies && task.dependencies.length > 0) {
                task.promise = Promise.all(task.dependencies.map((dependency) => this.runTask(dependency)))
                    .then((results: TaskResult[]) => {
                        const mergedResults: TaskResult = {};
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
                    .catch((e) => {
                        if (this.options.onTaskCancel) {
                            this.options.onTaskCancel(taskName);
                        }
                        throw e;
                    })
                    .then((previousResults) => this.runSingleTask(task, taskName, previousResults));
            } else {
                task.promise = this.runSingleTask(task, taskName, {});
            }
            task.visited = false;

            return task.promise.then((result: TaskResult) => {
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

    private runSingleTask(task: TaskInfo<any>, taskName: string, dependencyResults: TaskResult): Promise<TaskResult> {
        return task.task(dependencyResults)
            .then((result: TaskResult) => {
                return {
                    [taskName]: result
                };
            })
            .catch((e) => {
                if (this.options.onTaskFail) {
                    this.options.onTaskFail(taskName);
                }
                throw e;
            });
    }

    private throwIfInProgress() {
        if (this.execInProgress) {
            throw new Error(`You cannot modify the task tree while execution is in progress.`);
        }
    }
}

export { TaskRunner };
