import { TaskResult } from "./TaskResult";

export interface AsyncTask<T> {
    (results?: TaskResult, done?: (result: T) => void): void;
}

export interface SyncTask<T> {
    (results?: TaskResult): T;
}

export interface PromiseTask<T> {
    (results?: TaskResult): Promise<T>;
}

export type Task<T> = SyncTask<T> | AsyncTask<T> | PromiseTask<T>;
