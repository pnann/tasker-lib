"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskRunError = void 0;
/**
 * The top-level error that is emitted on a failed call to `TaskRunner.run`. Includes a map of all failed tasks to their
 * associated Error.
 */
var TaskRunError = /** @class */ (function (_super) {
    __extends(TaskRunError, _super);
    function TaskRunError(failedTasks) {
        var _this = _super.call(this) || this;
        _this.failedTaskMap = failedTasks;
        return _this;
    }
    return TaskRunError;
}(Error));
exports.TaskRunError = TaskRunError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFza1J1bkVycm9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL1Rhc2tSdW5FcnJvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFQTs7O0dBR0c7QUFDSDtJQUEyQixnQ0FBSztJQUc1QixzQkFBWSxXQUF5QjtRQUFyQyxZQUNJLGlCQUFPLFNBRVY7UUFERyxLQUFJLENBQUMsYUFBYSxHQUFHLFdBQVcsQ0FBQzs7SUFDckMsQ0FBQztJQUNMLG1CQUFDO0FBQUQsQ0FBQyxBQVBELENBQTJCLEtBQUssR0FPL0I7QUFFTyxvQ0FBWSJ9