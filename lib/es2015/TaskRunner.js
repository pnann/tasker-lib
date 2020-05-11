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
     * @internal
     */
    constructor(options, promisifier = new Promisifier()) {
        this.taskMap = {};
        this.execInProgress = false;
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
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
    addTask(taskName, dependencies, task) {
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
            promise: null,
            startTime: -1,
            task: task ? this.promisifier.wrap(task) : () => Promise.resolve({})
        };
    }
    /**
     * Removes a given task from the task tree. This will result in the task no longer existing, but will *not* affect
     * any tasks that may depend on it.
     *
     * @param taskName - The unique name of the task to remove. Does nothing if the task does not exist.
     */
    removeTask(taskName) {
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
    addDependencies(taskName, dependencies) {
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
     * @param taskName - The unique name of the task to remove dependencies from.
     * @param dependencies - One ore more dependencies to remove from the given task.
     */
    removeDependencies(taskName, dependencies) {
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
     * @param taskName - The unique name of the task to run.
     * @returns A promise that resolves when the task has completed.
     */
    run(taskName) {
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
                    .catch((e) => {
                    if (this.options.onTaskCancel) {
                        this.options.onTaskCancel(taskName);
                    }
                    throw e;
                })
                    .then((previousResults) => this.runSingleTask(task, taskName, previousResults));
            }
            else {
                task.promise = this.runSingleTask(task, taskName, {});
            }
            task.visited = false;
            return task.promise.then((result) => {
                const totalTime = Date.now() - task.startTime;
                if (this.options.onTaskEnd) {
                    this.options.onTaskEnd(taskName, totalTime);
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
        task.startTime = Date.now();
        return task.task(dependencyResults)
            .then((result) => {
            return {
                [taskName]: result
            };
        })
            .catch((e) => {
            if (this.options.onTaskFail) {
                this.options.onTaskFail(taskName, e);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFza1J1bm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9UYXNrUnVubmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFjNUMsTUFBTSxlQUFlLEdBQVk7SUFDN0IsZ0JBQWdCLEVBQUUsSUFBSTtDQUN6QixDQUFDO0FBRUY7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtQkc7QUFDSCxNQUFNLFVBQVU7SUFjWjs7T0FFRztJQUNILFlBQVksT0FBaUIsRUFBRSxXQUFXLEdBQUcsSUFBSSxXQUFXLEVBQUU7UUFidEQsWUFBTyxHQUEwQyxFQUFFLENBQUM7UUFDcEQsbUJBQWMsR0FBRyxLQUFLLENBQUM7UUFhM0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDM0QsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7SUFDbkMsQ0FBQztJQUdEOzs7Ozs7Ozs7Ozs7Ozs7O09BZ0JHO0lBQ0gsT0FBTyxDQUFJLFFBQWdCLEVBQUUsWUFBMEMsRUFBRSxJQUFjO1FBQ25GLElBQUksUUFBUSxLQUFLLElBQUksSUFBSSxRQUFRLEtBQUssU0FBUyxFQUFFO1lBQzdDLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQztTQUN4QztRQUNELElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBRXpCLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ3pELE1BQU0sSUFBSSxLQUFLLENBQUMsUUFBUSxRQUFRLGtCQUFrQixDQUFDLENBQUM7U0FDdkQ7UUFFRCxJQUFJLE9BQU8sWUFBWSxLQUFLLFVBQVUsRUFBRTtZQUNwQyxJQUFJLEdBQUcsWUFBWSxDQUFDO1lBQ3BCLFlBQVks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