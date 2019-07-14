/**
 * A class that massages synchronous and some async functions into promises. Expects very specific function signatures.
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
export { Promisifier };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvbWlzaWZpZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvUHJvbWlzaWZpZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBR0E7O0dBRUc7QUFDSCxNQUFNLFdBQVc7SUFFYjs7Ozs7Ozs7OztPQVVHO0lBQ0gsSUFBSSxDQUFJLEVBQVc7UUFDZixPQUFPLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFFZjs7O2VBR0c7WUFDSCxJQUFJLEVBQUUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO2dCQUNqQixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO29CQUNuQixFQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUU7d0JBQ3BDLElBQUksTUFBTSxZQUFZLEtBQUssRUFBRTs0QkFDekIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO3lCQUNsQjs2QkFBTTs0QkFDSCxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7eUJBQ25CO29CQUNMLENBQUMsQ0FBQyxDQUFDO2dCQUNQLENBQUMsQ0FBQyxDQUFDO2FBQ047aUJBQU07Z0JBQ0gsSUFBSTtvQkFDQSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQWdCLEVBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2lCQUN2RDtnQkFBQyxPQUFPLENBQUMsRUFBRTtvQkFDUixPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQzVCO2FBQ0o7UUFDTCxDQUFDLENBQUE7SUFDTCxDQUFDO0NBQ0o7QUFFRCxPQUFPLEVBQUUsV0FBVyxFQUFFLENBQUMifQ==