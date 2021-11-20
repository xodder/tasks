import defaultsDeep from 'lodash/defaultsDeep';
import React from 'react';

export const TaskStatusEnum = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
};

class Task {
  _observers = [];

  constructor(id) {
    this.id = id;
    this.state = {
      status: TaskStatus.IDLE,
    };
  }

  addObserver(observer) {
    this._observers.push(observer);
  }

  removeObserver(observer) {
    this._observers.splice(this._observers.indexOf(observer), 1);
  }

  async runWith(def, variables) {
    this._updateState({ status: TaskStatus.RUNNING });

    const rollbackContext = def.handlers.onStart(variables);

    try {
      const result = await def.execute(variables);

      if (result && result.error) {
        throw result;
      }

      this._updateState({
        status: TaskStatus.SUCCESS,
        data: def.persistent ? def.getDataToPersist(result) : null,
      });

      const resolvedResult =
        def.handlers.onSuccess(result, variables, rollbackContext) || result;
      def.handlers.onComplete(variables);
      return resolvedResult;
    } catch (error) {
      this._updateState({ status: TaskStatus.ERROR, error });
      def.handlers.onError(error, variables, rollbackContext);
      def.handlers.onComplete(variables);
      throw error;
    }
  }

  _updateState(updates) {
    this.state = {
      ...this.state,
      ...updates,
    };

    this._observers.forEach((observer) => {
      observer(this.state);
    });
  }

  reset() {
    this.state = {};
    this._observers.forEach((observer) => {
      observer(this.state);
    });
  }

  canBeDestroyed() {
    return this._observers.length === 0;
  }

  destroy() {
    this.state = {};
    this._observers = [];
  }
}

class TaskManager {
  _tasks = {};

  has(taskId) {
    return this._tasks[taskId];
  }

  get(taskId) {
    return this._tasks[taskId];
  }

  add(task) {
    this._tasks[task.id] = task;
  }

  maybeRemove(taskId) {
    const task = this._tasks[taskId];
    if (task && task.canBeDestroyed()) {
      this.remove(taskId);
    }
  }

  remove(taskId) {
    const task = this._tasks[taskId];
    task.destroy();
    delete this._tasks[taskId];
  }
}

function useRerender() {
  const [, rerender_] = React.useReducer((c) => c + 1, 0);
  const mountedRef = React.useRef();

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return React.useCallback(() => {
    if (mountedRef.current) {
      rerender_();
    }
  }, []);
}

const taskManager = new TaskManager();

function getOrCreateTask(taskId) {
  let task = taskManager.get(taskId);
  if (!task) {
    task = new Task(taskId);
    taskManager.add(task);
  }
  return task;
}

export function useTaskState(taskId) {
  const rerender = useRerender();
  const observerRef = React.useRef();
  const task = getOrCreateTask(taskId);

  React.useEffect(() => {
    let observer = observerRef.current;
    if (!observer) {
      observer = function () {
        rerender();
      };
    }

    task.addObserver(observer);

    observerRef.current = observer;
    return () => {
      task.removeObserver(observer);
      taskManager.maybeRemove(task.id);
    };
  }, [rerender, task]);

  const state = task?.state || {};

  return {
    status: state.status || TaskStatus.IDLE,
    isRunning: state.status === TaskStatus.RUNNING,
    data: state.data,
    error: state.error,
  };
}

const defaultTaskDef = {
  getDataToPersist: (data) => data,
  handlers: {
    onStart: () => {},
    onSuccess: () => {},
    onError: () => {},
    onComplete: () => {},
  },
};

function runTask(taskDef, variables) {
  const task = getOrCreateTask(taskDef.id);
  const actualDef = defaultsDeep(taskDef, defaultTaskDef);
  return task.runWith(actualDef, variables);
}

export function useTask(taskDef) {
  if (!taskDef.id) {
    throw new Error('task must have an id');
  }

  const state = useTaskState(taskDef.id);
  const perform = usePerformTask(taskDef);
  const reset = React.useCallback(() => {
    getOrCreateTask(taskDef.id).reset();
  }, [taskDef.id]);

  return {
    ...state,
    perform,
    reset,
  };
}

export function usePerformTask(taskDef) {
  const perform = React.useCallback(
    async (variables) => {
      const result = [];

      try {
        const resolvedTaskDef =
          typeof taskDef === 'function' ? taskDef(variables) : taskDef;
        result[0] = await runTask(resolvedTaskDef, variables);
      } catch (error) {
        if (error.retryable) {
          error.retry = (function (variables) {
            return () => perform(variables);
          })(variables);
        }
        result[1] = error;
      }

      return result;
    },
    [taskDef]
  );

  return perform;
}

export function useIsTaskRunning(taskId) {
  return useTaskState(taskId)?.isRunning;
}
