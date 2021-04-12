import { AsyncTask, SyncTask, Task } from "./Task";
import { TaskResultMap } from "./TaskResultMap";

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
    wrap<T>(fn: Task<T>): (results: T) => Promise<TaskResultMap> {
        return (results: T) => {

            /*
             * 2nd param is "done" -- if the user fn has exactly two params then it is expected that they are using a
             * classic asynchronous function and will call "done" when complete.
             */
            if (fn.length === 2) {
                return new Promise((resolve, reject) => {
                    (<AsyncTask<T>> fn)(results, (result) => {
                        if (result instanceof Error) {
                            reject(result);
                        } else {
                            resolve(result);
                        }
                    });
                });
            } else {
                try {
                    return Promise.resolve((<SyncTask<T>> fn)(results));
                } catch (e) {
                    return Promise.reject(e);
                }
            }
        }
    }
}

/** @internal */
export { Promisifier };
