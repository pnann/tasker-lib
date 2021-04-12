/**
 * The top-level error that is emitted on a failed call to `TaskRunner.run`. Includes a map of all failed tasks to their
 * associated Error.
 */
class TaskRunError extends Error {
    constructor(failedTasks) {
        super();
        this.failedTaskMap = failedTasks;
    }
}
export { TaskRunError };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFza1J1bkVycm9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL1Rhc2tSdW5FcnJvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQTs7O0dBR0c7QUFDSCxNQUFNLFlBQWEsU0FBUSxLQUFLO0lBRzVCLFlBQVksV0FBeUI7UUFDakMsS0FBSyxFQUFFLENBQUM7UUFDUixJQUFJLENBQUMsYUFBYSxHQUFHLFdBQVcsQ0FBQztJQUNyQyxDQUFDO0NBQ0o7QUFFRCxPQUFPLEVBQUMsWUFBWSxFQUFDLENBQUMifQ==