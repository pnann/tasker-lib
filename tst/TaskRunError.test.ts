import {TaskErrorMap} from "../src/TaskErrorMap";
import {TaskRunError} from "../src/TaskRunError";

describe("TaskRunError", () => {
    it("should build from a TaskErrorMap", function () {
        const failedTaskMap: TaskErrorMap = {};
        const error = new TaskRunError(failedTaskMap);
        expect(error.failedTaskMap).toBe(failedTaskMap);
    });
});
