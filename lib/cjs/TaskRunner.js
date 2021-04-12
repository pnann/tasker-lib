"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskRunner = void 0;
var Promisifier_1 = require("./Promisifier");
var TaskRunError_1 = require("./TaskRunError");
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
     * @internal
     */
    function TaskRunner(options, promisifier) {
        if (promisifier === void 0) { promisifier = new Promisifier_1.Promisifier(); }
        this.taskMap = {};
        this.taskErrorMap = {};
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
    TaskRunner.prototype.addTask = function (taskName, dependencies, task) {
        if (taskName === null || taskName === undefined) {
            throw new Error("Missing task name");
        }
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
            promise: null,
            startTime: -1,
            task: task ? this.promisifier.wrap(task) : function () { return Promise.resolve({}); }
        };
    };
    /**
     * Removes a given task from the task tree. This will result in the task no longer existing, but will *not* affect
     * any tasks that may depend on it.
     *
     * @param taskName - The unique name of the task to remove. Does nothing if the task does not exist.
     */
    TaskRunner.prototype.removeTask = function (taskName) {
        if (taskName === null || taskName === undefined) {
            throw new Error("Missing task name");
        }
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
     * @param taskName - The unique name of the task to add dependencies to.
     * @param dependencies - One or more dependencies to add to the given task.
     */
    TaskRunner.prototype.addDependencies = function (taskName, dependencies) {
        if (taskName === null || taskName === undefined) {
            throw new Error("Missing task name");
        }
        if (dependencies === null || dependencies === undefined) {
            throw new Error("Missing dependencies");
        }
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
     * @param taskName - The unique name of the task to remove dependencies from.
     * @param dependencies - One ore more dependencies to remove from the given task.
     */
    TaskRunner.prototype.removeDependencies = function (taskName, dependencies) {
        if (taskName === null || taskName === undefined) {
            throw new Error("Missing task name");
        }
        if (dependencies === null || dependencies === undefined) {
            throw new Error("Missing dependencies");
        }
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
     * Rejects the promise if any tasks fail, with the payload being a TaskRunError containing a map of all failed task
     * names to their associated Error.
     *
     * Rejects the promise if no tasks exist with the given name, or a task is found with a non-existent dependency.
     *
     * Rejects the promise if there is a cycle in the task tree.
     *
     * @param taskName - The unique name of the task to run.
     * @returns A promise that resolves when the task has completed.
     */
    TaskRunner.prototype.run = function (taskName) {
        var _this = this;
        if (taskName === null || taskName === undefined) {
            return Promise.reject(new Error("Missing task name"));
        }
        this.throwIfInProgress();
        this.execInProgress = true;
        this.taskErrorMap = {};
        return this.runTask(taskName)
            .then(function (results) {
            _this.execInProgress = false;
            return results;
        })
            .catch(function (error) {
            _this.taskErrorMap[taskName] = error;
            _this.execInProgress = false;
            throw new TaskRunError_1.TaskRunError(_this.taskErrorMap);
        });
    };
    TaskRunner.prototype.runTask = function (taskName) {
        var _this = this;
        var task = this.taskMap[taskName];
        if (!task) {
            return Promise.reject(new Error("Task '" + taskName + "' not found"));
        }
        if (task.visited) {
            return Promise.reject(new Error("Cycle found at '" + taskName + "'"));
        }
        // If the task has already been started by another dependent, use that promise directly.
        if (task.promise) {
            return task.promise;
        }
        // Trigger onTaskStart when we're about to start the task; this happens BEFORE dependencies are evaluated.
        if (this.options.onTaskStart) {
            this.options.onTaskStart(taskName, task.dependencies);
        }
        task.visited = true;
        if (task.dependencies && task.dependencies.length > 0) {
            task.promise = this.runAllDependentTasks(task.dependencies)
                .catch(function (e) {
                if (_this.options.onTaskCancel) {
                    _this.options.onTaskCancel(taskName);
                }
                throw e;
            })
                .then(function (previousResults) { return _this.runStandaloneTask(task, taskName, previousResults); });
        }
        else {
            task.promise = this.runStandaloneTask(task, taskName, {});
        }
        task.visited = false;
        return task.promise.then(function (result) {
            var totalTime = Date.now() - task.startTime;
            if (_this.options.onTaskEnd) {
                _this.options.onTaskEnd(taskName, totalTime);
            }
            task.promise = null;
            return result;
        });
    };
    TaskRunner.prototype.runStandaloneTask = function (task, taskName, dependencyResults) {
        var _this = this;
        task.startTime = Date.now();
        return task.task(dependencyResults)
            .catch(function (error) {
            if (_this.options.onTaskFail) {
                _this.options.onTaskFail(taskName, error);
            }
            _this.taskErrorMap[taskName] = error;
            throw error;
        });
    };
    TaskRunner.prototype.throwIfInProgress = function () {
        if (this.execInProgress) {
            throw new Error("You cannot modify the task tree while execution is in progress.");
        }
    };
    /**
     * Runs all dependency tasks by name, returning a TaskResultMap on success, and a TaskErrorMap on failure.
     *
     * @param dependencyNames
     * @private
     */
    TaskRunner.prototype.runAllDependentTasks = function (dependencyNames) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var results = {};
            var failedTasks = [];
            var remainingTaskCount = dependencyNames.length;
            var _loop_1 = function (name) {
                _this.runTask(name)
                    .then(function (result) {
                    results[name] = result;
                    if (--remainingTaskCount === 0) {
                        if (failedTasks.length === 0) {
                            resolve(results);
                        }
                        else {
                            reject(new Error("Dependency failures: " + failedTasks));
                        }
                    }
                })
                    .catch(function () {
                    failedTasks.push(name);
                    if (--remainingTaskCount === 0 || _this.options.stopOnFirstError) {
                        reject(new Error("Dependency failures: " + failedTasks));
                    }
                });
            };
            for (var _i = 0, dependencyNames_1 = dependencyNames; _i < dependencyNames_1.length; _i++) {
                var name = dependencyNames_1[_i];
                _loop_1(name);
            }
        });
    };
    return TaskRunner;
}());
exports.TaskRunner = TaskRunner;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFza1J1bm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9UYXNrUnVubmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUEwQztBQUsxQywrQ0FBNEM7QUFhNUMsSUFBTSxlQUFlLEdBQVk7SUFDN0IsZ0JBQWdCLEVBQUUsSUFBSTtDQUN6QixDQUFDO0FBRUY7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtQkc7QUFDSDtJQWVJOztPQUVHO0lBQ0gsb0JBQVksT0FBaUIsRUFBRSxXQUErQjtRQUEvQiw0QkFBQSxFQUFBLGtCQUFrQix5QkFBVyxFQUFFO1FBZHRELFlBQU8sR0FBMEMsRUFBRSxDQUFDO1FBQ3BELGlCQUFZLEdBQWlCLEVBQUUsQ0FBQztRQUNoQyxtQkFBYyxHQUFHLEtBQUssQ0FBQztRQWEzQixJQUFJLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLGVBQWUsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMzRCxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztJQUNuQyxDQUFDO0lBR0Q7Ozs7Ozs7Ozs7Ozs7Ozs7T0FnQkc7SUFDSCw0QkFBTyxHQUFQLFVBQVcsUUFBZ0IsRUFBRSxZQUEwQyxFQUFFLElBQWM7UUFDbkYsSUFBSSxRQUFRLEtBQUssSUFBSSxJQUFJLFFBQVEsS0FBSyxTQUFTLEVBQUU7WUFDN0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1NBQ3hDO1FBQ0QsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDekQsTUFBTSxJQUFJLEtBQUssQ0FBQyxVQUFRLFFBQVEscUJBQWtCLENBQUMsQ0FBQztTQUN2RDtRQUVELElBQUksT0FBTyxZQUFZLEtBQUssVUFBVSxFQUFFO1lBQ3BDLElB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