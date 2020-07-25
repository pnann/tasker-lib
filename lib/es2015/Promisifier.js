/**
 * A class that massages synchronous and some async functions into promises. Expects very specific function signatures.
 * @internal
 */
class Promisifier {
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
    wrap(fn) {
        return (results) => {
            /*
             * 2nd param is "done" -- if the user fn has exactly two params then it is expected that they are using a
             * classic asynchronous function and will call "done" when complete.
             */
            if (fn.length === 2) {
                return new Promise((resolve, reject) => {
                    fn(results, (result) => {
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
    }
}
/** @internal */
export { Promisifier };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvbWlzaWZpZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvUHJvbWlzaWZpZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBR0E7OztHQUdHO0FBQ0gsTUFBTSxXQUFXO0lBRWI7Ozs7Ozs7Ozs7T0FVRztJQUNILElBQUksQ0FBSSxFQUFXO1FBQ2YsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBRWY7OztlQUdHO1lBQ0gsSUFBSSxFQUFFLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtnQkFDakIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtvQkFDbkIsRUFBRyxDQUFDLE9BQU8sRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFO3dCQUNwQyxJQUFJLE1BQU0sWUFBWSxLQUFLLEVBQUU7NEJBQ3pCLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQzt5QkFDbEI7NkJBQU07NEJBQ0gsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO3lCQUNuQjtvQkFDTCxDQUFDLENBQUMsQ0FBQztnQkFDUCxDQUFDLENBQUMsQ0FBQzthQUNOO2lCQUFNO2dCQUNILElBQUk7b0JBQ0EsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFnQixFQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztpQkFDdkQ7Z0JBQUMsT0FBTyxDQUFDLEVBQUU7b0JBQ1IsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUM1QjthQUNKO1FBQ0wsQ0FBQyxDQUFBO0lBQ0wsQ0FBQztDQUNKO0FBRUQsZ0JBQWdCO0FBQ2hCLE9BQU8sRUFBRSxXQUFXLEVBQUUsQ0FBQyJ9