"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskRunner = void 0;
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
                    .catch(function (e) {
                    if (_this.options.onTaskCancel) {
                        _this.options.onTaskCancel(taskName);
                    }
                    throw e;
                })
                    .then(function (previousResults) { return _this.runSingleTask(task, taskName, previousResults); });
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
                _this.options.onTaskFail(taskName, e);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFza1J1bm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9UYXNrUnVubmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUE0QztBQWE1QyxJQUFNLGVBQWUsR0FBWTtJQUM3QixnQkFBZ0IsRUFBRSxJQUFJO0NBQ3pCLENBQUM7QUFFRjs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW1CRztBQUNIO0lBT0k7Ozs7O09BS0c7SUFDSCxvQkFBWSxPQUFrQyxFQUFFLFdBQStCO1FBQW5FLHdCQUFBLEVBQUEseUJBQWtDO1FBQUUsNEJBQUEsRUFBQSxrQkFBa0IseUJBQVcsRUFBRTtRQVR2RSxZQUFPLEdBQXFDLEVBQUUsQ0FBQztRQUMvQyxtQkFBYyxHQUFHLEtBQUssQ0FBQztRQVMzQixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7O09BaUJHO0lBQ0gsNEJBQU8sR0FBUCxVQUFXLFFBQWdCLEVBQUUsWUFBMEMsRUFBRSxJQUFjO1FBQ25GLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBRXpCLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ3pELE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBUSxRQUFRLHFCQUFrQixDQUFDLENBQUM7U0FDdkQ7UUFFRCxJQUFJLE9BQU8sWUFBWSxLQUFLLFVBQVUsRUFBRTtZQUNwQyxJQUFJLEdBQUcsWUFBWSxDQUFDO1lBQ3BCLFlBQVksR0FBRyxFQUFFLENBQUM7U0FDckI7YUFBTSxJQUFJLE9BQU8sWUFBWSxLQUFLLFFBQVEsRUFBRTtZQUN6QyxZQUFZLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztTQUNqQzthQUFNLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDdEIs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