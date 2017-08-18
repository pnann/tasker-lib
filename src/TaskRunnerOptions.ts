interface Options {
    onTaskStart?: (taskName: string) => void;
    onTaskEnd?: (taskName: string) => void;
    throwOnOverwrite?: boolean;
}

export {Options}