"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Promisifier_1 = require("./Promisifier");
var DEFAULT_OPTIONS = {
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
var TaskRunner = (function () {
    /**
     * Creates a new TaskRunner with optional options.
     *
     * @param {Options} options An optional object containing various configurable options.
     * @param {Promisifier} promisifier An override for the Promisifier. Only for unit testing.
     */
    function TaskRunner(options, promisifier) {
        if (options === void 0) { options = DEFAULT_OPTIONS; }
        if (promisifier === void 0) { promisifier = new Promisifier_1.Promisifier(); }
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
    TaskRunner.prototype.addTask = function (taskName, dependencies, task) {
        this.throwIfInProgress();
        if (this.options.throwOnOverwrite && this.taskMap[taskName]) {
            throw new Error("Task " + taskName + " already exists.");
        }
        if (typeof dependencies === "function") {
            task = dependencies;
            dependencies = [];
        }
        else if (typeof dependencies === "string") {
            dependencies = [dependencies];
        }
        this.taskMap[taskName] = {
            taskName: taskName,
            dependencies: dependencies,
            task: this.promisifier.wrap(task)
        };
    };
    /**
     * Removes a given task from the task tree. This will result in the task no longer existing, but will *not* affect
     * any tasks that may depend on it.
     *
     * @param {string} taskName - The unique name of the task to remove. Does nothing if the task does not exist.
     */
    TaskRunner.prototype.removeTask = function (taskName) {
        this.throwIfInProgress();
        delete this.taskMap[taskName];
    };
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
    TaskRunner.prototype.addDependencies = function (taskName, dependencies) {
        this.throwIfInProgress();
        var task = this.taskMap[taskName];
        if (task) {
            if (typeof dependencies === "string") {
                dependencies = [dependencies];
            }
            for (var _i = 0, dependencies_1 = dependencies; _i < dependencies_1.length; _i++) {
                var dependency = dependencies_1[_i];
                if (task.dependencies.indexOf(dependency) === -1) {
                    task.dependencies.push(dependency);
                }
            }
        }
        else {
            throw new Error("Can't add dependency for missing task " + taskName);
        }
    };
    /**
     * Removes one or more dependencies from the given task. This will not remove the dependent tasks themselves, but
     * only the dependency link. This does nothing if the task does not exist or if there is no dependency link in
     * place.
     *
     * @param {string} taskName - The unique name of the task to remove dependencies from.
     * @param {(string | string[])} dependencies - One ore more dependencies to remove from the given task.
     */
    TaskRunner.prototype.removeDependencies = function (taskName, dependencies) {
        this.throwIfInProgress();
        var task = this.taskMap[taskName];
        if (task) {
            if (typeof dependencies === "string") {
                dependencies = [dependencies];
            }
            task.dependencies = task.dependencies.filter(function (dependency) {
                return dependencies.indexOf(dependency) === -1;
            });
        }
    };
    /**
     * Returns a list of all tasks and their associated dependencies.
     *
     * @returns {{taskName: string}: string[]}
     */
    TaskRunner.prototype.getTaskList = function () {
        var map = {};
        for (var taskName in this.taskMap) {
            /* istanbul ignore else */
            if (this.taskMap.hasOwnProperty(taskName)) {
                map[taskName] = this.taskMap[taskName].dependencies;
            }
        }
        return map;
    };
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
    TaskRunner.prototype.run = function (taskName) {
        var _this = this;
        this.throwIfInProgress();
        this.execInProgress = true;
        return this.runTask(taskName)
            .then(function (results) { return results ? results[taskName] : null; })
            .then(function (results) {
            _this.execInProgress = false;
            return results;
        })
            .catch(function (error) {
            _this.execInProgress = false;
            throw error;
        });
    };
    TaskRunner.prototype.runTask = function (taskName) {
        var _this = this;
        var task = this.taskMap[taskName];
        if (task) {
            if (task.visited) {
                return Promise.reject(new Error("Cycle found at '" + taskName + "'"));
            }
            if (task.promise) {
                return task.promise;
            }
            if (this.options.onTaskStart) {
                this.options.onTaskStart(taskName);
            }
            task.visited = true;
            if (task.dependencies && task.dependencies.length > 0) {
                task.promise = Promise.all(task.dependencies.map(function (dependency) { return _this.runTask(dependency); }))
                    .then(function (results) {
                    var mergedResults = {};
                    for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
                        var result = results_1[_i];
                        for (var taskName_1 in result) {
                            /* istanbul ignore else */
                            if (_this.taskMap.hasOwnProperty(taskName_1)) {
                                mergedResults[taskName_1] = result[taskName_1];
                            }
                        }
                    }
                    return mergedResults;
                })
                    .then(function (previousResults) { return task.task(previousResults); });
            }
            else {
                task.promise = task.task({})
                    .then(function (result) {
                    return _a = {},
                        _a[taskName] = result,
                        _a;
                    var _a;
                });
            }
            task.visited = false;
            return task.promise.then(function (result) {
                if (_this.options.onTaskEnd) {
                    _this.options.onTaskEnd(taskName);
                }
                task.promise = null;
                return result;
            });
        }
        else {
            return Promise.reject(new Error("Task '" + taskName + "' not found"));
        }
    };
    TaskRunner.prototype.throwIfInProgress = function () {
        if (this.execInProgress) {
            throw new Error("You cannot modify the task tree while execution is in progress.");
        }
    };
    return TaskRunner;
}());
exports.TaskRunner = TaskRunner;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFza1J1bm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9UYXNrUnVubmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkNBQTBDO0FBYTFDLElBQU0sZUFBZSxHQUFZO0lBQzdCLGdCQUFnQixFQUFFLElBQUk7Q0FDekIsQ0FBQztBQUVGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUJHO0FBQ0g7SUFPSTs7Ozs7T0FLRztJQUNILG9CQUFZLE9BQWtDLEVBQUUsV0FBK0I7UUFBbkUsd0JBQUEsRUFBQSx5QkFBa0M7UUFBRSw0QkFBQSxFQUFBLGtCQUFrQix5QkFBVyxFQUFFO1FBVHZFLFlBQU8sR0FBcUMsRUFBRSxDQUFDO1FBQy9DLG1CQUFjLEdBQUcsS0FBSyxDQUFDO1FBUzNCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO0lBQ25DLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FpQkc7SUFDSCw0QkFBTyxHQUFQLFVBQVcsUUFBZ0IsRUFBRSxZQUF5QyxFQUFFLElBQWM7UUFDbEYsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxRCxNQUFNLElBQUksS0FBSyxDQUFDLFVBQVEsUUFBUSxxQkFBa0IsQ0FBQyxDQUFDO1FBQ3hELENBQUM7UUFFRCxFQUFFLENBQUMsQ0FBQyxPQUFPLFlBQVksS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ3JDLElBQUksR0FBRyxZQUFZLENBQUM7WUFDcEIsWUFBWSxHQUFHLEVBQUUsQ0FBQztRQUN0QixDQUFDO1FBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sWUFBWSxLQUFLLFFBQVEsQ0FBQyxDQUFD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