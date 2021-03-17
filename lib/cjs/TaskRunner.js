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
     * @internal
     */
    function TaskRunner(options, promisifier) {
        if (promisifier === void 0) { promisifier = new Promisifier_1.Promisifier(); }
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
                var totalTime = Date.now() - task.startTime;
                if (_this.options.onTaskEnd) {
                    _this.options.onTaskEnd(taskName, totalTime);
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
        task.startTime = Date.now();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFza1J1bm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9UYXNrUnVubmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUE0QztBQWM1QyxJQUFNLGVBQWUsR0FBWTtJQUM3QixnQkFBZ0IsRUFBRSxJQUFJO0NBQ3pCLENBQUM7QUFFRjs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW1CRztBQUNIO0lBY0k7O09BRUc7SUFDSCxvQkFBWSxPQUFpQixFQUFFLFdBQStCO1FBQS9CLDRCQUFBLEVBQUEsa0JBQWtCLHlCQUFXLEVBQUU7UUFidEQsWUFBTyxHQUEwQyxFQUFFLENBQUM7UUFDcEQsbUJBQWMsR0FBRyxLQUFLLENBQUM7UUFhM0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDM0QsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7SUFDbkMsQ0FBQztJQUdEOzs7Ozs7Ozs7Ozs7Ozs7O09BZ0JHO0lBQ0gsNEJBQU8sR0FBUCxVQUFXLFFBQWdCLEVBQUUsWUFBMEMsRUFBRSxJQUFjO1FBQ25GLElBQUksUUFBUSxLQUFLLElBQUksSUFBSSxRQUFRLEtBQUssU0FBUyxFQUFFO1lBQzdDLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQztTQUN4QztRQUNELElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBRXpCLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ3pELE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBUSxRQUFRLHFCQUFrQixDQUFDLENBQUM7U0FDdkQ7UUFFRCxJQUFJLE9BQU8sWUFBWSxLQUFLLFVBQVUsRUFBRTtZQUNwQyxJQUFJLEdBQUcsWUFBWSxDQUFDO1lBQ3BCLFlBQVksR0FBRyxFQUFFLENB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