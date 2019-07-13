import { Promisifier } from "./Promisifier";
const DEFAULT_OPTIONS = {
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
    /**
     * Creates a new TaskRunner with optional options.
     *
     * @param {Options} options An optional object containing various configurable options.
     * @param {Promisifier} promisifier An override for the Promisifier. Only for unit testing.
     */
    constructor(options = DEFAULT_OPTIONS, promisifier = new Promisifier()) {
        this.taskMap = {};
        this.execInProgress = false;
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
    addTask(taskName, dependencies, task) {
        this.throwIfInProgress();
        if (this.options.throwOnOverwrite && this.taskMap[taskName]) {
            throw new Error(`Task ${taskName} already exists.`);
        }
        if (typeof dependencies === "function") {
            task = dependencies;
            dependencies = [];
        }
        else if (typeof dependencies === "string") {
            dependencies = [dependencies];
        }
        else if (!dependencies) {
            dependencies = [];
        }
        this.taskMap[taskName] = {
            taskName: taskName,
            dependencies: dependencies,
            task: task ? this.promisifier.wrap(task) : () => Promise.resolve()
        };
    }
    /**
     * Removes a given task from the task tree. This will result in the task no longer existing, but will *not* affect
     * any tasks that may depend on it.
     *
     * @param {string} taskName - The unique name of the task to remove. Does nothing if the task does not exist.
     */
    removeTask(taskName) {
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
    addDependencies(taskName, dependencies) {
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
        }
        else {
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
    removeDependencies(taskName, dependencies) {
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
    getTaskList() {
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
    run(taskName) {
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
    runTask(taskName) {
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
                    .then((results) => {
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
                    .then((previousResults) => this.runSingleTask(task, taskName, previousResults))
                    .catch((e) => {
                    if (this.options.onTaskCancel) {
                        this.options.onTaskCancel(taskName);
                    }
                    throw e;
                });
            }
            else {
                task.promise = this.runSingleTask(task, taskName, {});
            }
            task.visited = false;
            return task.promise.then((result) => {
                if (this.options.onTaskEnd) {
                    this.options.onTaskEnd(taskName);
                }
                task.promise = null;
                return result;
            });
        }
        else {
            return Promise.reject(new Error(`Task '${taskName}' not found`));
        }
    }
    runSingleTask(task, taskName, dependencyResults) {
        return task.task(dependencyResults)
            .then((result) => {
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
    throwIfInProgress() {
        if (this.execInProgress) {
            throw new Error(`You cannot modify the task tree while execution is in progress.`);
        }
    }
}
export { TaskRunner };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFza1J1bm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9UYXNrUnVubmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFhNUMsTUFBTSxlQUFlLEdBQVk7SUFDN0IsZ0JBQWdCLEVBQUUsSUFBSTtDQUN6QixDQUFDO0FBRUY7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtQkc7QUFDSCxNQUFNLFVBQVU7SUFPWjs7Ozs7T0FLRztJQUNILFlBQVksVUFBbUIsZUFBZSxFQUFFLFdBQVcsR0FBRyxJQUFJLFdBQVcsRUFBRTtRQVR2RSxZQUFPLEdBQXFDLEVBQUUsQ0FBQztRQUMvQyxtQkFBYyxHQUFHLEtBQUssQ0FBQztRQVMzQixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7O09BaUJHO0lBQ0gsT0FBTyxDQUFJLFFBQWdCLEVBQUUsWUFBMEMsRUFBRSxJQUFjO1FBQ25GLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBRXpCLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ3pELE1BQU0sSUFBSSxLQUFLLENBQUMsUUFBUSxRQUFRLGtCQUFrQixDQUFDLENBQUM7U0FDdkQ7UUFFRCxJQUFJLE9BQU8sWUFBWSxLQUFLLFVBQVUsRUFBRTtZQUNwQyxJQUFJLEdBQUcsWUFBWSxDQUFDO1lBQ3BCLFlBQVksR0FBRyxFQUFFLENBQUM7U0FDckI7YUFBTSxJQUFJLE9BQU8sWUFBWSxLQUFLLFFBQVEsRUFBRTtZQUN6QyxZQUFZLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztTQUNqQzthQUFNLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDdEIsWUFBWSxH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