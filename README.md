# tasker-lib

> A simple library for defining and executing JavaScript task trees.

[![Build Status](https://travis-ci.org/pnann/tasker-lib.svg)](https://travis-ci.org/pnann/tasker-lib)
![npm dependencies](https://david-dm.org/pnann/tasker-lib.svg)
[![Coverage Status](https://coveralls.io/repos/github/pnann/tasker-lib/badge.svg?branch=master)](https://coveralls.io/github/pnann/tasker-lib?branch=master) 
[![npm version](https://badge.fury.io/js/tasker-lib.svg)](https://badge.fury.io/js/tasker-lib)

## Features
* Support for synchronous, asynchronous, and promise-based tasks.
* Automatic result passing between dependent tasks.
* Rich API for building and modifying task trees.
* Small, dependency-free, and available as both ES2015 and CommonJS libraries.

## Installation
```console
$ npm install tasker-lib
```
> Note: `tasker-lib` requires a Promise implementation available on the global object.

## Usage

Have you previously used a task-based build system? You'll feel right at home with the `tasker-lib` API.

Using `tasker-lib` is quick and easy:
1. Create a new `TaskRunner`, optionally supplying configuration.
2. Add tasks through the `addTask` method. 
3. Optionally modify the task tree by using `removeTask`, `addDependencies`, and `removeDependencies`. These may only be called
   while tasks are not being executed.
4. Optionally use the dependency results with the `results` object. Each task only has access to the results of its direct dependencies.
5. Run a task, and all its dependencies, with the `run` method. All methods are locked during execution.

### General
```javascript
import {TaskRunner} from "tasker-lib";

const taskRunner = new TaskRunner();

// This synchronous task returns 1, which becomes available to tasks that depend on it through the "results" object.
taskRunner.addTask("dependency", () => 1);

taskRunner.addTask("root", ["dependency"], (results) => {
   const dependencyResult = results["dependency"];
   console.log(`Result of "dependency" is: ${dependencyResult}`); // 1
   
   return dependencyResult + 1;
});

taskRunner.run("root").then((finalResult) => {
    console.log(`Final results are ${finalResult}`); // finalResult === 2
});
```

#### With Promises
```javascript
// The dependency list is optional for tasks that have no dependencies.
taskRunner.addTask("promise-task", (results) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve("some-async-result");
        }, 1000);
    });
});
```

#### With async callback
```javascript
taskRunner.addTask("async-task", (results, done) => {
    setTimeout(() => {
        done("some-async-result");
    }, 1000);
});
```

### With addDependencies, removeDependencies
Dependencies can be added or removed to any task that has already been added. Calling `addDependency` multiple times with
the same taskName and dependencies will be ignored after the first call.

```javascript
taskRunner.addTask("root", () => 3);

// Dependencies may be added before they exist, but the parent task must exist at this point.
taskRunner.addDependencies("root", ["child1"]);

taskRunner.addTask("child1", () => 1);
taskRunner.addTask("child2", () => 2);

taskRunner.addDependencies("child1", "child2"); // A string may be used instead of an array for single dependencies.

taskRunner.removeDependencies("root", "child1"); // child2 is still a dependency of child1, but not of root.
```

#### With `throwOnOverwrite = false`
```javascript
const options = {
    throwOnOverwrite: false // defaults to true
};

const taskRunner = new TaskRunner(options);
taskRunner.addTask("root", () => 1);
taskRunner.addTask("root", () => 1); // This would throw if throwOnOverwrite is true.
```

#### With `onTaskStart` and `onTaskEnd` callbacks
```javascript
const options = {
    onTaskStart: (taskName) => {
        console.log(`Task started: '${taskName}'`);  
    },
    
    onTaskEnd: (taskName) => {
        console.log(`Task ended: '${taskName}'`);
    }
};

const taskRunner = new TaskRunner(options);
taskRunner.addTask("root", () => console.log(" - Running! - "));
taskRunner.run("root");

// Task started: 'root'
//  - Running! -
// Task ended: 'root'
```

### [API](tasker-lib.d.ts)

### Command Line
For command line usage, see [tasker-cli](https://github.org/pnann/tasker-cli).

## Versioning
`tasker-lib` uses [SemVer](http://semver.org/) for versioning. All releases will be available on both GitHub and npm.

## [License](LICENSE)
MIT
