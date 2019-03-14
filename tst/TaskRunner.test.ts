import { TaskRunner } from "../src/TaskRunner";

describe("TaskRunner", () => {
    let taskRunner: TaskRunner;
    beforeEach(() => {
        taskRunner = new TaskRunner();
    });

    const addTask = function (name: string, dependencies: string[] = []): Function {
        const task = jest.fn();
        taskRunner.addTask(name, dependencies, task);

        return task;
    };

    describe("missing tasks", () => {
        it("errors if the expected task doesn't exist", () => {
            expect.assertions(1);
            return taskRunner.run("root").catch((error) => {
                expect(error).toBeDefined();
            });
        });

        it("errors if the expected dependencies don't exist", () => {
            const rootTask = addTask("root", ["missingTask"]);

            expect.assertions(1);
            return taskRunner.run("root").catch(() => {
                expect(rootTask).not.toHaveBeenCalled();
            });
        });
    });

    describe("cycle handling", () => {
        it("errors when cycles are detected", () => {
            const child1 = addTask("child1", ["root"]);
            const root = addTask("root", ["child1"]);

            expect.assertions(2);
            return taskRunner.run("root").catch(() => {
                expect(root).not.toHaveBeenCalled();
                expect(child1).not.toHaveBeenCalled();
            });
        });

        it("errors when there's a long cycle", () => {
            const child4 = addTask("child4", ["root"]);
            const child3 = addTask("child3", ["child4"]);
            const child2 = addTask("child2", ["child3"]);
            const child1 = addTask("child1", ["child2"]);
            const root = addTask("root", ["child1"]);

            expect.assertions(5);
            return taskRunner.run("root").catch(() => {
                expect(root).not.toHaveBeenCalled();
                expect(child1).not.toHaveBeenCalled();
                expect(child2).not.toHaveBeenCalled();
                expect(child3).not.toHaveBeenCalled();
                expect(child4).not.toHaveBeenCalled();
            });
        });

        it("errors a task depends on itself", () => {
            const root = addTask("root", ["root"]);

            expect.assertions(1);
            return taskRunner.run("root").catch(() => {
                expect(root).not.toHaveBeenCalled();
            });
        });
    });

    describe("standard tasks", () => {
        it("executes a single task without dependencies", () => {
            const root = addTask("root");
            return taskRunner.run("root").then(() => expect(root).toHaveBeenCalled());
        });

        it("executes a single task without dependencies nor an actual callback", function () {
            taskRunner.addTask("root");
            return taskRunner.run("root");
        });

        it("executes a single task added with the two-param shorthand.", () => {
            const root = jest.fn();
            taskRunner.addTask("root", root);

            return taskRunner.run("root").then(() => expect(root).toHaveBeenCalled());
        });

        it("will run tasks again if run twice", () => {
            const root = addTask("root");
            return taskRunner.run("root").then(() => taskRunner.run("root")).then(() => expect(root).toHaveBeenCalledTimes(2));
        });

        it("executes each duplicate child only once", () => {
            const child2 = addTask("child2");
            const child1 = addTask("child1", ["child2"]);
            const root = addTask("root", ["child1", "child2"]);

            return taskRunner.run("root").then(() => {
                expect(child2).toHaveBeenCalledTimes(1);
                expect(child1).toHaveBeenCalledTimes(1);
                expect(root).toHaveBeenCalledTimes(1);
            });
        });

        it("executes dependent tasks once per run call, not caching between top-level executions", () => {
            const child2 = addTask("child2");
            const child1 = addTask("child1", ["child2"]);
            const root = addTask("root", ["child1", "child2"]);

            return taskRunner.run("root").then(() => taskRunner.run("root")).then(() => {
                expect(child2).toHaveBeenCalledTimes(2);
                expect(child1).toHaveBeenCalledTimes(2);
                expect(root).toHaveBeenCalledTimes(2);
            });
        });

        it("executes a tree of nodes, in order", () => {
            let currentOrder = 0;
            const expectOrder = (expectedOrder: number) => jest.fn(() => expect(currentOrder++).toBe(expectedOrder));

            const child2 = expectOrder(0);
            taskRunner.addTask("child2", [], child2);

            const child1 = expectOrder(1);
            taskRunner.addTask("child1", ["child2"], child1);

            const root = expectOrder(2);
            taskRunner.addTask("root", ["child1", "child2"], root);

            return taskRunner.run("root").then(() => {
                expect(child2).toHaveBeenCalledTimes(1);
                expect(child1).toHaveBeenCalledTimes(1);
                expect(root).toHaveBeenCalledTimes(1);
            });
        });

        it("runs leaf nodes asynchronously and in parallel if able", () => {
            const childDones = [];

            const onChildStarted = () => {
                if (childDones.length === 2) {
                    for (const done of childDones) {
                        done();
                    }
                    expect(true).toEqual(true);
                }
            };

            const child2 = (results, done) => {
                childDones.push(done);
                onChildStarted();
            };

            const child1 = (results, done) => {
                childDones.push(done);
                onChildStarted();
            };

            taskRunner.addTask("child2", child2);
            taskRunner.addTask("child1", child1);
            taskRunner.addTask("root", ["child1", "child2"], jest.fn());

            expect.assertions(1);
            return taskRunner.run("root");
        });

        it("should throw an error when adding a task when one already exists.", () => {
            addTask("root");

            expect(() => {
                addTask("root");
            }).toThrow();
        });

        it("adding a task with the same name overwrites the first one, if throwOnOverwrite is false", () => {
            taskRunner = new TaskRunner({throwOnOverwrite: false});
            const originalTask = addTask("root");
            const newTask = addTask("root");

            return taskRunner.run("root").then(() => {
                expect(originalTask).not.toHaveBeenCalled();
                expect(newTask).toHaveBeenCalledTimes(1);
            });
        });

        it("tasks can be added with dependencies that don't yet exist", () => {
            const root = addTask("root", ["child1"]);
            const child1 = addTask("child1");

            return taskRunner.run("root").then(() => {
                expect(child1).toHaveBeenCalledTimes(1);
                expect(root).toHaveBeenCalledTimes(1);
            });
        });

        it("can add dependencies by string, rather than string array", () => {
            const child1 = addTask("child1");
            const root = jest.fn();
            taskRunner.addTask("root", "child1", root);

            return taskRunner.run("root").then(() => {
                expect(child1).toHaveBeenCalledTimes(1);
                expect(root).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe("addDependency", () => {
        it("can have dependencies added to already existing tasks", () => {
            const root = addTask("root");
            const child1 = addTask("child1");

            taskRunner.addDependencies("root", ["child1"]);

            return taskRunner.run("root").then(() => {
                expect(child1).toHaveBeenCalledTimes(1);
                expect(root).toHaveBeenCalledTimes(1);
            });
        });

        it("can have only a single dependency added as a string, rather than an array.", () => {
            const root = addTask("root");
            const child1 = addTask("child1");

            taskRunner.addDependencies("root", "child1");

            return taskRunner.run("root").then(() => {
                expect(child1).toHaveBeenCalledTimes(1);
                expect(root).toHaveBeenCalledTimes(1);
            });
        });

        it("throws an error when adding a dependency to a non-existent task.", () => {
            expect(() => {
                taskRunner.addTask("root", [], jest.fn());
                taskRunner.addDependencies("missingTask", ["root"]);
            }).toThrow();
        });

        it("deduplicates when adding a dependency that already exists.", () => {
            const child1 = addTask("child1");
            const root = addTask("root", ["child1"]);

            taskRunner.addDependencies("root", ["child1"]);

            return taskRunner.run("root").then(() => {
                expect(child1).toHaveBeenCalledTimes(1);
                expect(root).toHaveBeenCalledTimes(1);
            });
        });

        it("deduplicates when adding the same dependency multiple times.", () => {
            const child1 = addTask("child1");
            const root = addTask("root");

            taskRunner.addDependencies("root", ["child1"]);
            taskRunner.addDependencies("root", ["child1"]);

            return taskRunner.run("root").then(() => {
                expect(child1).toHaveBeenCalledTimes(1);
                expect(root).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe("removeDependency", () => {
        it("will do nothing when removing a dependency that does not exist.", () => {
            taskRunner.addTask("root", [], jest.fn());
            taskRunner.removeDependencies("root", ["missingDependency"]);
        });

        it("will do nothing when removing a dependency for a task that doesn't exist.", () => {
            taskRunner.addTask("root", [], jest.fn());
            taskRunner.removeDependencies("missingTask", ["root"]);
        });

        it("won't call a removed dependency.", () => {
            const child2 = addTask("child2");
            const child1 = addTask("child1");
            const root = addTask("root", ["child1", "child2"]);

            taskRunner.removeDependencies("root", ["child1"]);

            return taskRunner.run("root").then(() => {
                expect(child1).not.toHaveBeenCalled();
                expect(child2).toHaveBeenCalledTimes(1);
                expect(root).toHaveBeenCalledTimes(1);
            });
        });

        it("won't call a dependency removed as a string, rather than an array", () => {
            const child2 = addTask("child2");
            const child1 = addTask("child1");
            const root = addTask("root", ["child1", "child2"]);

            taskRunner.removeDependencies("root", "child1");

            return taskRunner.run("root").then(() => {
                expect(child1).not.toHaveBeenCalled();
                expect(child2).toHaveBeenCalledTimes(1);
                expect(root).toHaveBeenCalledTimes(1);
            });
        });

        it("can be remove multiple dependencies.", () => {
            const child2 = addTask("child2");
            const child1 = addTask("child1", ["child2"]);
            const root = addTask("root", ["child1", "child2"]);

            taskRunner.removeDependencies("root", ["child1", "child2"]);
            return taskRunner.run("root").then(() => {
                expect(child2).not.toHaveBeenCalled();
                expect(child1).not.toHaveBeenCalled();
                expect(root).toHaveBeenCalledTimes(1);
            });
        });

        it("can remove non-root dependencies.", () => {
            const child2 = addTask("child2");
            const child1 = addTask("child1", ["child2"]);
            const root = addTask("root", ["child1"]);

            taskRunner.removeDependencies("child1", ["child2"]);

            return taskRunner.run("root").then(() => {
                expect(child2).not.toHaveBeenCalled();
                expect(child1).toHaveBeenCalledTimes(1);
                expect(root).toHaveBeenCalledTimes(1);
            });
        });

        it("ignores duplicates in the removal list.", () => {
            const child1 = addTask("child1");
            const root = addTask("root", ["child1"]);

            taskRunner.removeDependencies("root", ["child1", "child1"]);

            return taskRunner.run("root").then(() => {
                expect(child1).not.toHaveBeenCalled();
                expect(root).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe("removeTask", () => {
        it("should do nothing if the task does not exist.", () => {
            taskRunner.removeTask("root");
        });

        it("should remove a task if it exists.", () => {
            const root = addTask("root");
            taskRunner.removeTask("root");

            expect.assertions(1);
            return taskRunner.run("root").catch(() => {
                expect(root).not.toHaveBeenCalled();
            });
        });

        it("should not affect tasks that depend on the removed task.", () => {
            const child1 = addTask("child1");
            const root = addTask("root", ["child1"]);

            taskRunner.removeTask("child1");

            expect.assertions(2);
            return taskRunner.run("root").catch(() => {
                expect(child1).not.toHaveBeenCalled();
                expect(root).not.toHaveBeenCalled();
            });
        });
    });

    describe("result passing", () => {
        it("should pass the end result of the run to caller.", () => {
            const rootResults = 6;
            taskRunner.addTask("root", [], () => rootResults);

            expect.assertions(1);
            return taskRunner.run("root").then((results) => {
                expect(results).toBe(rootResults);
            });
        });

        it("should pass the results of dependencies to tasks.", () => {
            const child1Result = 6;
            taskRunner.addTask("child1", [], () => child1Result);

            taskRunner.addTask("root", ["child1"], (results) => {
                expect(results["child1"]).toBe(child1Result);
            });

            expect.assertions(1);
            return taskRunner.run("root");
        });

        it("should pass null results of dependencies to tasks.", () => {
            const child1Result = null;
            taskRunner.addTask("child1", [], () => child1Result);

            taskRunner.addTask("root", ["child1"], (results) => {
                expect(results["child1"]).toBe(child1Result);
            });

            expect.assertions(1);
            return taskRunner.run("root");
        });
    });

    describe("execution locking", () => {
        const expectThrow = function (expectedThrowFunction) {
            let onComplete = null;
            const task = (results, done) => {
                onComplete = done;
            };
            taskRunner.addTask("root", task);

            const runningPromise = taskRunner.run("root");

            expect(() => expectedThrowFunction()).toThrow();

            onComplete();
            return runningPromise;
        };

        it("should throw if run is called while a run is in progress", () => {
            return expectThrow(() => taskRunner.run("root"));
        });

        it("should throw if addDependencies is called while a run is in progress", () => {
            return expectThrow(() => taskRunner.addDependencies("root", "other"));
        });

        it("should throw if removeDependencies is called while a run is in progress", () => {
            return expectThrow(() => taskRunner.removeDependencies("root", "other"));
        });

        it("should throw if addTask is called while a run is in progress", () => {
            return expectThrow(() => taskRunner.addTask("other", jest.fn()));
        });

        it("should throw if removeTask is called while a run is in progress", () => {
            return expectThrow(() => taskRunner.removeTask("other"));
        });
    });

    describe("getTaskList", () => {
        it("should return an empty map if no tasks are added", () => {
            expect(taskRunner.getTaskList()).toEqual({});
        });

        it("should return a single task if only one task exists", () => {
            taskRunner.addTask("root", jest.fn());
            expect(taskRunner.getTaskList()).toEqual({
                "root": []
            });
        });

        it("should return every task and all dependencies", () => {
            addTask("child2");
            addTask("child1", ["child2"]);
            addTask("root", ["child1", "child2"]);

            expect(taskRunner.getTaskList()).toEqual({
                "child2": [],
                "child1": ["child2"],
                "root": ["child1", "child2"]
            });
        });
    });

    describe("onTaskStart, onTaskEnd", () => {
        it("should call onTaskStart when tasks start", () => {
            const onTaskStart = jest.fn();
            const onTaskEnd = jest.fn();
            taskRunner = new TaskRunner({onTaskStart: onTaskStart, onTaskEnd: onTaskEnd});

            taskRunner.addTask("root", [], () => {
                expect(onTaskEnd).not.toHaveBeenCalled();
                expect(onTaskStart).toHaveBeenCalledWith("root", []);
            });

            return taskRunner.run("root").then(() => {
                expect(onTaskStart).toHaveBeenCalledTimes(1);
            });
        });

        it("should call onTaskEnd when the task has ended", () => {
            const onTaskEnd = jest.fn();
            taskRunner = new TaskRunner({onTaskEnd: onTaskEnd});

            addTask("child1");
            return taskRunner.addTask("root", ["child1"], () => {
                expect(onTaskEnd).toHaveBeenCalledWith("child1");
            });
        });

        it("should call onTaskStart and onTaskEnd for each task", () => {
            const onTaskStart = jest.fn();
            const onTaskEnd = jest.fn();

            taskRunner = new TaskRunner({onTaskStart: onTaskStart, onTaskEnd: onTaskEnd});

            addTask("child2");
            addTask("child1", ["child2"]);
            addTask("root", ["child1", "child2"]);

            return taskRunner.run("root").then(() => {
                expect(onTaskEnd).toHaveBeenCalledTimes(3);
                expect(onTaskEnd).toBeCalledWith("child2");
                expect(onTaskEnd).toBeCalledWith("child1");
                expect(onTaskEnd).toBeCalledWith("root");

                expect(onTaskStart).toHaveBeenCalledTimes(3);
                expect(onTaskStart).toBeCalledWith("child2", []);
                expect(onTaskStart).toBeCalledWith("child1", ["child2"]);
                expect(onTaskStart).toBeCalledWith("root", ["child1", "child2"]);
            });
        });
    });
});
