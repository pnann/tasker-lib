import { Promisifier } from "../src/Promisifier";
import { Task } from "../src/Task";

describe("Promisifier", () => {
    let promisifier: Promisifier;
    let results: object;
    beforeEach(() => {
        promisifier = new Promisifier();
        results = {};
    });

    const expectSuccess = (fn, expectedResult) => {
        expect.assertions(1);
        return promisifier.wrap(fn)(results).then((result) => {
            expect(result).toBe(expectedResult);
        });
    };

    const expectFailure = (fn: Task<any>, expectedResult) => {
        expect.assertions(1);
        return promisifier.wrap(fn)(results).catch((result) => {
            expect(result).toBe(expectedResult);
        });
    };

    describe("synchronous results", () => {
        it("should resolve with the result returned by the function", () => {
            const expectedResult = 1701;
            return expectSuccess(() => expectedResult, expectedResult);
        });

        it("should resolve with null if returned by the function", () => {
            const expectedResult = null;
            return expectSuccess(() => expectedResult, expectedResult);
        });

        it("should resolve with undefined if returned by the function", () => {
            return expectSuccess(() => {
            }, undefined);
        });

        it("should reject if an error is thrown", () => {
            const error = new Error("Rejected!");

            return expectFailure(() => {
                throw error;
            }, error);
        });
    });

    describe("promises", () => {
        it("should pass the result of the promise directly through", () => {
            const expectedResult = 1701;
            return expectSuccess(() => Promise.resolve(expectedResult), expectedResult);
        });

        it("should reject if the promise rejects", () => {
            const error = new Error("Rejected!");
            return expectFailure(() => Promise.reject(error), error);
        });
    });

    describe("done callback", () => {
        it("should resolve the promise with the result of calling done", () => {
            const expectedResult = 1701;
            const fn = (results, done) => {
                done(expectedResult);
            };

            return expectSuccess(fn, expectedResult);
        });

        it("should reject the promise if the result of calling done is an error", () => {
            const error = new Error("Rejected!");
            const fn = (results, done) => {
                done(error);
            };

            return expectFailure(fn, error);
        });
    });
});