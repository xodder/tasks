type Maybe<T> = T | undefined;
export type TaskError<TResult = unknown> = Error & {
    retryable: boolean;
    reason?: string;
    message: string;
    retry?: () => Promise<TaskPerformFuncResult<TResult>>;
};
type TaskId = string;
type TaskStatus = 'idle' | 'running' | 'success' | 'error';
interface TaskState<TResult> {
    status: TaskStatus;
    isRunning: boolean;
    data: any;
    error: TaskError<TResult> | null;
}
export type TaskHandlers<TInput = unknown, TResult = unknown, TRollback = unknown> = {
    onStart?: (inputVariables: TInput) => Maybe<TRollback>;
    onSuccess?: (result: TResult, inputVariables: TInput, rollbackContext: Maybe<TRollback>) => any;
    onError?: (error: TaskError<TResult>, inputVariables: TInput, rollbackContext: Maybe<TRollback>) => void;
    onComplete?: (inputVariables: TInput) => void;
};
export type TaskPerformFuncResult<TResult = unknown> = [
    TResult,
    TaskError<TResult>
];
export type TaskPerformFunc<TInput = unknown, TResult = unknown> = (inputVariables?: TInput) => Promise<TaskPerformFuncResult<TResult>>;
export interface TaskDefObj<TInput = unknown, TResult = unknown, TRollback = unknown> {
    id: TaskId;
    execute: (inputVariables?: TInput) => Promise<TResult>;
    persistent?: boolean;
    getDataToPersist?: (result: TResult) => any;
    handlers?: TaskHandlers<TInput, TResult, TRollback>;
}
export type TaskDef<TInput = unknown, TResult = unknown, TRollback = unknown> = TaskDefObj<TInput, TResult, TRollback> | ((inputVariables?: TInput) => TaskDefObj<TInput, TResult, TRollback>);
export type UseTaskResult<TInput = unknown, TResult = unknown> = TaskState<TResult> & {
    perform: TaskPerformFunc<TInput, TResult>;
    reset: () => void;
};
declare const TaskStatus: {
    readonly IDLE: "idle";
    readonly RUNNING: "running";
    readonly SUCCESS: "success";
    readonly ERROR: "error";
};
export declare function useTaskState<TInput = unknown, TResult = unknown, TRollback = unknown>(taskId: TaskId): TaskState<TResult>;
export declare function usePerformTask<TInput = unknown, TResult = unknown, TRollback = unknown>(taskDef: TaskDef<TInput, TResult, TRollback>): (variables?: TInput) => Promise<TaskPerformFuncResult<TResult>>;
export declare function useTask<TInput = unknown, TResult = unknown, TRollback = unknown>(taskDef: TaskDefObj<TInput, TResult, TRollback>): UseTaskResult<TInput, TResult>;
export declare function useIsTaskRunning(taskId: TaskId): boolean;
export {};
//# sourceMappingURL=index.d.ts.map