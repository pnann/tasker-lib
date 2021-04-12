"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Promisifier = void 0;
/**
 * A class that massages synchronous and some async functions into promises. Expects very specific function signatures.
 * @internal
 */
var Promisifier = /** @class */ (function () {
    function Promisifier() {
    }
    /**
     * Takes a function and wraps it in a function which returns a promise.
     *
     * Supports:
     *  - Promises
     *  - "done" callback
     *  - sync returns (including Promises, Gulp streams, etc.)
     *
     * @param {(results, done) => any} fn
     * @returns {(results) => Promise}
     */
    Promisifier.prototype.wrap = function (fn) {
        return function (results) {
            /*
             * 2nd param is "done" -- if the user fn has exactly two params then it is expected that they are using a
             * classic asynchronous function and will call "done" when complete.
             */
            if (fn.length === 2) {
                return new Promise(function (resolve, reject) {
                    fn(results, function (result) {
                        if (result instanceof Error) {
                            reject(result);
                        }
                        else {
                            resolve(result);
                        }
                    });
                });
            }
            else {
                try {
                    return Promise.resolve(fn(results));
                }
                catch (e) {
                    return Promise.reject(e);
                }
            }
        };
    };
    return Promisifier;
}());
exports.Promisifier = Promisifier;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvbWlzaWZpZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvUHJvbWlzaWZpZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBR0E7OztHQUdHO0FBQ0g7SUFBQTtJQXVDQSxDQUFDO0lBckNHOzs7Ozs7Ozs7O09BVUc7SUFDSCwwQkFBSSxHQUFKLFVBQVEsRUFBVztRQUNmLE9BQU8sVUFBQyxPQUFVO1lBRWQ7OztlQUdHO1lBQ0gsSUFBSSxFQUFFLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtnQkFDakIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxVQUFDLE9BQU8sRUFBRSxNQUFNO29CQUNmLEVBQUcsQ0FBQyxPQUFPLEVBQUUsVUFBQyxNQUFNO3dCQUNoQyxJQUFJLE1BQU0sWUFBWSxLQUFLLEVBQUU7NEJBQ3pCLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQzt5QkFDbEI7NkJBQU07NEJBQ0gsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO3lCQUNuQjtvQkFDTCxDQUFDLENBQUMsQ0FBQztnQkFDUCxDQUFDLENBQUMsQ0FBQzthQUNOO2lCQUFNO2dCQUNILElBQUk7b0JBQ0EsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFnQixFQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztpQkFDdkQ7Z0JBQUMsT0FBTyxDQUFDLEVBQUU7b0JBQ1IsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUM1QjthQUNKO1FBQ0wsQ0FBQyxDQUFBO0lBQ0wsQ0FBQztJQUNMLGtCQUFDO0FBQUQsQ0FBQyxBQXZDRCxJQXVDQztBQUdRLGtDQUFXIn0=