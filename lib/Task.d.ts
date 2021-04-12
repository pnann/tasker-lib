import { TaskResultMap } from "./TaskResultMap";
export interface AsyncTask<T> {
    (results?: TaskResultMap, done?: (result: T) => void): void;
}
export interface SyncTask<T> {
    (results?: TaskResultMap): T;
}
export interface PromiseTask<T> {
    (results?: TaskResultMap): Promise<T>;
}
export declare type Task<T> = SyncTask<T> | AsyncTask<T> | PromiseTask<T>;
