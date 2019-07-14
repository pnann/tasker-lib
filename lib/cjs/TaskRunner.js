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
var TaskRunner = /** @class */ (function () {
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
        else if (!dependencies) {
            dependencies = [];
        }
        this.taskMap[taskName] = {
            taskName: taskName,
            dependencies: dependencies,
            task: task ? this.promisifier.wrap(task) : function () { return Promise.resolve(); }
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
                this.options.onTaskStart(taskName, task.dependencies);
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
                    .then(function (previousResults) { return _this.runSingleTask(task, taskName, previousResults); })
                    .catch(function (e) {
                    if (_this.options.onTaskCancel) {
                        _this.options.onTaskCancel(taskName);
                    }
                    throw e;
                });
            }
            else {
                task.promise = this.runSingleTask(task, taskName, {});
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
    TaskRunner.prototype.runSingleTask = function (task, taskName, dependencyResults) {
        var _this = this;
        return task.task(dependencyResults)
            .then(function (result) {
            var _a;
            return _a = {},
                _a[taskName] = result,
                _a;
        })
            .catch(function (e) {
            if (_this.options.onTaskFail) {
                _this.options.onTaskFail(taskName);
            }
            throw e;
        });
    };
    TaskRunner.prototype.throwIfInProgress = function () {
        if (this.execInProgress) {
            throw new Error("You cannot modify the task tree while execution is in progress.");
        }
    };
    return TaskRunner;
}());
exports.TaskRunner = TaskRunner;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFza1J1bm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9UYXNrUnVubmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkNBQTRDO0FBYTVDLElBQU0sZUFBZSxHQUFZO0lBQzdCLGdCQUFnQixFQUFFLElBQUk7Q0FDekIsQ0FBQztBQUVGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUJHO0FBQ0g7SUFPSTs7Ozs7T0FLRztJQUNILG9CQUFZLE9BQWtDLEVBQUUsV0FBK0I7UUFBbkUsd0JBQUEsRUFBQSx5QkFBa0M7UUFBRSw0QkFBQSxFQUFBLGtCQUFrQix5QkFBVyxFQUFFO1FBVHZFLFlBQU8sR0FBcUMsRUFBRSxDQUFDO1FBQy9DLG1CQUFjLEdBQUcsS0FBSyxDQUFDO1FBUzNCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO0lBQ25DLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FpQkc7SUFDSCw0QkFBTyxHQUFQLFVBQVcsUUFBZ0IsRUFBRSxZQUEwQyxFQUFFLElBQWM7UUFDbkYsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDekQsTUFBTSxJQUFJLEtBQUssQ0FBQyxVQUFRLFFBQVEscUJBQWtCLENBQUMsQ0FBQztTQUN2RDtRQUVELElBQUksT0FBTyxZQUFZLEtBQUssVUFBVSxFQUFFO1lBQ3BDLElBQUksR0FBRyxZQUFZLENBQUM7WUFDcEIsWUFBWSxHQUFHLEVBQUUsQ0FBQztTQUNyQjthQUFNLElBQUksT0FBTyxZQUFZLEtBQUssUUFBUSxFQUFFO1lBQ3pDLFlBQVksR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO1NBQ2pDO2FBQU0sSUFBSSxDQUFDLFlBQVksRUFBRTtZQUN0QixZ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