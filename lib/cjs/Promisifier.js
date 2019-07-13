"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * A class that massages synchronous and some async functions into promises. Expects very specific function signatures.
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvbWlzaWZpZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvUHJvbWlzaWZpZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQTs7R0FFRztBQUNIO0lBQUE7SUF1Q0EsQ0FBQztJQXJDRzs7Ozs7Ozs7OztPQVVHO0lBQ0gsMEJBQUksR0FBSixVQUFRLEVBQVc7UUFDZixPQUFPLFVBQUMsT0FBTztZQUVYOzs7ZUFHRztZQUNILElBQUksRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7Z0JBQ2pCLE9BQU8sSUFBSSxPQUFPLENBQUMsVUFBQyxPQUFPLEVBQUUsTUFBTTtvQkFDZixFQUFHLENBQUMsT0FBTyxFQUFFLFVBQUMsTUFBTTt3QkFDaEMsSUFBSSxNQUFNLFlBQVksS0FBSyxFQUFFOzRCQUN6QixNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7eUJBQ2xCOzZCQUFNOzRCQUNILE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQzt5QkFDbkI7b0JBQ0wsQ0FBQyxDQUFDLENBQUM7Z0JBQ1AsQ0FBQyxDQUFDLENBQUM7YUFDTjtpQkFBTTtnQkFDSCxJQUFJO29CQUNBLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBZ0IsRUFBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7aUJBQ3ZEO2dCQUFDLE9BQU8sQ0FBQyxFQUFFO29CQUNSLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDNUI7YUFDSjtRQUNMLENBQUMsQ0FBQTtJQUNMLENBQUM7SUFDTCxrQkFBQztBQUFELENBQUMsQUF2Q0QsSUF1Q0M7QUFFUSxrQ0FBVyJ9