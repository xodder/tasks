import { TaskStatusEnum } from '.';

type TaskInput = Record<any, any>;
type TaskResult = any;
type TaskError = {
  error?: any;
  retryable?: boolean;
  reason?: string;
  message: string;
  retry?: () => void;
};
type TaskRollbackContext = Record<any, any> | (() => any);

type TaskStatus = 'idle' | 'running' | 'success' | 'error';

interface TaskState {
  status: TaskStatus;
  isRunning: boolean;
  data: any;
  error: TaskError;
}

type TaskPerformFuncResult = [TaskResult, TaskError];

type TaskPerformFunc = (
  inputVariables: TaskInput
) => Promise<TaskPerformFuncResult>;

interface TaskDefObj {
  id: any;
  execute: TaskPerformFunc;
  persistent?: boolean;
  getDataToPersist?: (result: TaskResult) => any;
  handlers?: {
    onStart?: (inputVariables: TaskInput) => TaskRollbackContext;
    onSuccess?: (
      result: TaskResult,
      inputVariables: TaskInput,
      rollbackContext: TaskRollbackContext
    ) => any;
    onError?: (
      error: TaskError,
      inputVariables: TaskInput,
      rollbackContext: TaskRollbackContext
    ) => void;
    onComplete?: (inputVariables: TaskInput) => void;
  };
}

type TaskDef = TaskDefObj | ((inputVariables: TaskInput) => TaskDefObj);

export function usePerformTask(taskDef: TaskDef): TaskPerformFunc;

export type UseTaskResult = TaskState & {
  perform: TaskPerformFunc;
  reset: () => void;
};

export function useTask(taskDef: TaskDefObj): UseTaskResult;
export function useIsTaskRunning(taskId: any): boolean;
export function useTaskState(taskId: any): TaskState;
