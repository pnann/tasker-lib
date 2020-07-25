"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvbWlzaWZpZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvUHJvbWlzaWZpZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQTs7O0dBR0c7QUFDSDtJQUFBO0lBdUNBLENBQUM7SUFyQ0c7Ozs7Ozs7Ozs7T0FVRztJQUNILDBCQUFJLEdBQUosVUFBUSxFQUFXO1FBQ2YsT0FBTyxVQUFDLE9BQU87WUFFWDs7O2VBR0c7WUFDSCxJQUFJLEVBQUUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO2dCQUNqQixPQUFPLElBQUksT0FBTyxDQUFDLFVBQUMsT0FBTyxFQUFFLE1BQU07b0JBQ2YsRUFBRyxDQUFDLE9BQU8sRUFBRSxVQUFDLE1BQU07d0JBQ2hDLElBQUksTUFBTSxZQUFZLEtBQUssRUFBRTs0QkFDekIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO3lCQUNsQjs2QkFBTTs0QkFDSCxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7eUJBQ25CO29CQUNMLENBQUMsQ0FBQyxDQUFDO2dCQUNQLENBQUMsQ0FBQyxDQUFDO2FBQ047aUJBQU07Z0JBQ0gsSUFBSTtvQkFDQSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQWdCLEVBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2lCQUN2RDtnQkFBQyxPQUFPLENBQUMsRUFBRTtvQkFDUixPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQzVCO2FBQ0o7UUFDTCxDQUFDLENBQUE7SUFDTCxDQUFDO0lBQ0wsa0JBQUM7QUFBRCxDQUFDLEFBdkNELElBdUNDO0FBR1Esa0NBQVcifQ==