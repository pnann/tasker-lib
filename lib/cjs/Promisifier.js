"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * A class that massages synchronous and some async functions into promises. Expects very specific function signatures.
 */
var Promisifier = (function () {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvbWlzaWZpZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvUHJvbWlzaWZpZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQTs7R0FFRztBQUNIO0lBQUE7SUF1Q0EsQ0FBQztJQXJDRzs7Ozs7Ozs7OztPQVVHO0lBQ0gsMEJBQUksR0FBSixVQUFRLEVBQVc7UUFDZixNQUFNLENBQUMsVUFBQyxPQUFPO1lBRVg7OztlQUdHO1lBQ0gsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNsQixNQUFNLENBQUMsSUFBSSxPQUFPLENBQUMsVUFBQyxPQUFPLEVBQUUsTUFBTTtvQkFDZixFQUFHLENBQUMsT0FBTyxFQUFFLFVBQUMsTUFBTTt3QkFDaEMsRUFBRSxDQUFDLENBQUMsTUFBTSxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUM7NEJBQzFCLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQzt3QkFDbkIsQ0FBQzt3QkFBQyxJQUFJLENBQUMsQ0FBQzs0QkFDSixPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7d0JBQ3BCLENBQUM7b0JBQ0wsQ0FBQyxDQUFDLENBQUM7Z0JBQ1AsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ0osSUFBSSxDQUFDO29CQUNELE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFnQixFQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDeEQsQ0FBQztnQkFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNULE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixDQUFDO1lBQ0wsQ0FBQztRQUNMLENBQUMsQ0FBQTtJQUNMLENBQUM7SUFDTCxrQkFBQztBQUFELENBQUMsQUF2Q0QsSUF1Q0M7QUFFTyxrQ0FBVyJ9