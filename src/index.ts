import defaultsDeep from 'lodash/defaultsdeep';
import React from 'react';
import useRerender from './utils/use-rerender';

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

export type TaskHandlers<
  TInput = unknown,
  TResult = unknown,
  TRollback = unknown
> = {
  onStart?: (inputVariables: TInput) => Maybe<TRollback>;
  onSuccess?: (
    result: TResult,
    inputVariables: TInput,
    rollbackContext: Maybe<TRollback>
  ) => any;
  onError?: (
    error: TaskError<TResult>,
    inputVariables: TInput,
    rollbackContext: Maybe<TRollback>
  ) => void;
  onComplete?: (inputVariables: TInput) => void;
};

export type TaskPerformFuncResult<TResult = unknown> = [
  TResult,
  TaskError<TResult>
];

export type TaskPerformFunc<TInput = unknown, TResult = unknown> = (
  inputVariables?: TInput
) => Promise<TaskPerformFuncResult<TResult>>;

export interface TaskDefObj<
  TInput = unknown,
  TResult = unknown,
  TRollback = unknown
> {
  id: TaskId;
  execute: (inputVariables?: TInput) => Promise<TResult>;
  persistent?: boolean;
  getDataToPersist?: (result: TResult) => any;
  handlers?: TaskHandlers<TInput, TResult, TRollback>;
}

export type TaskDef<TInput = unknown, TResult = unknown, TRollback = unknown> =
  | TaskDefObj<TInput, TResult, TRollback>
  | ((inputVariables?: TInput) => TaskDefObj<TInput, TResult, TRollback>);

export type UseTaskResult<
  TInput = unknown,
  TResult = unknown
> = TaskState<TResult> & {
  perform: TaskPerformFunc<TInput, TResult>;
  reset: () => void;
};

type TaskObserver<TResult = unknown> = (taskState: TaskState<TResult>) => void;

const TaskStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

const __defaultTaskState = {
  status: TaskStatus.IDLE,
  data: null,
  error: null,
  isRunning: false,
};

class Task<TInput = unknown, TResult = unknown, TRollback = unknown> {
  id: TaskId;
  state: TaskState<TResult>;
  _observers: TaskObserver<TResult>[] = [];

  constructor(id: TaskId) {
    this.id = id;
    this.state = { ...__defaultTaskState };
  }

  addObserver(observer: TaskObserver<TResult>) {
    this._observers.push(observer);
    // observer?.(this.state);
  }

  removeObserver(observer: TaskObserver<TResult>) {
    this._observers.splice(this._observers.indexOf(observer), 1);
  }

  async runWith(
    def: TaskDefObj<TInput, TResult, TRollback>,
    variables?: TInput
  ) {
    this._updateState({ status: TaskStatus.RUNNING });

    const rollbackContext = def.handlers?.onStart?.(variables!);

    try {
      const result = await def.execute(variables);

      this._updateState({
        status: TaskStatus.SUCCESS,
        data:
          def.persistent && def.getDataToPersist
            ? def.getDataToPersist(result)
            : null,
      });

      const resolvedResult =
        (await def.handlers?.onSuccess?.(
          result,
          variables!,
          rollbackContext
        )) || result;

      def.handlers?.onComplete?.(variables!);

      return resolvedResult;
    } catch (error: any) {
      this._updateState({ status: TaskStatus.ERROR, error });

      def.handlers?.onError?.(error, variables!, rollbackContext);
      def.handlers?.onComplete?.(variables!);

      throw error;
    }
  }

  _updateState(updates: Partial<TaskState<TResult>>) {
    this.state = {
      ...this.state,
      ...updates,
    };

    this._observers.forEach((observer) => {
      observer(this.state);
    });
  }

  reset() {
    this.state = { ...__defaultTaskState };

    this._observers.forEach((observer) => {
      observer(this.state);
    });
  }

  canBeDestroyed() {
    return (
      this._observers.length === 0 && this.state.status !== TaskStatus.RUNNING
    );
  }

  destroy() {
    this._observers = [];
  }
}

class TaskManager {
  _tasks: Record<TaskId, Task> = {};

  has(taskId: TaskId) {
    return this._tasks[taskId];
  }

  get<TInput = unknown, TResult = unknown, TRollback = unknown>(
    taskId: TaskId
  ) {
    return this._tasks[taskId] as Task<TInput, TResult, TRollback>;
  }

  add<TInput = unknown, TResult = unknown, TRollback = unknown>(
    task: Task<TInput, TResult, TRollback>
  ) {
    this._tasks[task.id] = task as Task;
  }

  maybeRemove(taskId: TaskId) {
    const task = this._tasks[taskId];

    if (task && task.canBeDestroyed()) {
      this.remove(taskId);
    }
  }

  remove(taskId: TaskId) {
    const task = this._tasks[taskId];
    task.destroy();
    delete this._tasks[taskId];
  }
}

const taskManager = new TaskManager();

function getOrCreateTask<
  TInput = unknown,
  TResult = unknown,
  TRollback = unknown
>(taskId: TaskId) {
  if (!taskManager.has(taskId))
    taskManager.add(new Task<TInput, TResult, TRollback>(taskId));

  return taskManager.get<TInput, TResult, TRollback>(taskId);
}

export function useTaskState<
  TInput = unknown,
  TResult = unknown,
  TRollback = unknown
>(taskId: TaskId): TaskState<TResult> {
  const rerender = useRerender();
  const task = getOrCreateTask<TInput, TResult, TRollback>(taskId);

  const observerRef = React.useRef<TaskObserver<TResult>>(() => rerender());

  React.useEffect(() => {
    const observer = observerRef.current;

    task.addObserver(observer);

    return () => {
      if (observer) {
        task.removeObserver(observer);
      }

      taskManager.maybeRemove(task.id);
    };
  }, [rerender, task]);

  const state = task.state;

  return {
    status: state.status || TaskStatus.IDLE,
    isRunning: state.status === TaskStatus.RUNNING,
    data: state.data,
    error: state.error,
  };
}

const defaultTaskDef = {
  getDataToPersist: (data: any) => data,
  handlers: {
    onStart: () => void 0,
    onSuccess: () => void 0,
    onError: () => void 0,
    onComplete: () => void 0,
  },
};

function runTask<TInput = unknown, TResult = unknown, TRollback = unknown>(
  taskDef: TaskDefObj<TInput, TResult, TRollback>,
  variables?: TInput
) {
  const task = getOrCreateTask(taskDef.id);
  const actualDef = defaultsDeep(taskDef, defaultTaskDef);

  return task.runWith(actualDef, variables);
}

type RetryableError<TResult = unknown> = Error & {
  retryable: boolean;
  retry: () => Promise<TaskPerformFuncResult<TResult>>;
};

export function usePerformTask<
  TInput = unknown,
  TResult = unknown,
  TRollback = unknown
>(taskDef: TaskDef<TInput, TResult, TRollback>) {
  const perform = React.useCallback(
    async (variables?: TInput) => {
      const result: unknown[] = [];

      try {
        const actualTaskDef =
          typeof taskDef === 'function' ? taskDef(variables) : taskDef;

        result[0] = await runTask(actualTaskDef, variables);
      } catch (error: any) {
        const error__ = error as RetryableError<TResult>;

        if (error__.message) {
          if (error__.retryable) {
            error__.retry = (function (variables_) {
              return () => perform(variables_);
            })(variables);
          }
        }

        result[1] = error__;
      }

      return result as TaskPerformFuncResult<TResult>;
    },
    [taskDef]
  );

  return perform;
}

export function useTask<
  TInput = unknown,
  TResult = unknown,
  TRollback = unknown
>(
  taskDef: TaskDefObj<TInput, TResult, TRollback>
): UseTaskResult<TInput, TResult> {
  if (!taskDef.id) {
    throw new Error('task must have an id');
  }

  const state = useTaskState<TInput, TResult>(taskDef.id);
  const perform = usePerformTask<TInput, TResult, TRollback>(taskDef);
  const reset = React.useCallback(() => {
    getOrCreateTask(taskDef.id).reset();
  }, [taskDef.id]);

  return {
    ...state,
    perform,
    reset,
  };
}

export function useIsTaskRunning(taskId: TaskId) {
  return useTaskState(taskId)?.isRunning;
}
