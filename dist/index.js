"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useIsTaskRunning = exports.useTask = exports.usePerformTask = exports.useTaskState = void 0;
const defaultsDeep_1 = __importDefault(require("lodash/defaultsDeep"));
const react_1 = __importDefault(require("react"));
const use_rerender_1 = __importDefault(require("./utils/use-rerender"));
const TaskStatus = {
    IDLE: 'idle',
    RUNNING: 'running',
    SUCCESS: 'success',
    ERROR: 'error',
};
const __defaultTaskState = {
    status: TaskStatus.IDLE,
    data: null,
    error: null,
    isRunning: false,
};
class Task {
    id;
    state;
    _observers = [];
    constructor(id) {
        this.id = id;
        this.state = { ...__defaultTaskState };
    }
    addObserver(observer) {
        this._observers.push(observer);
    }
    removeObserver(observer) {
        this._observers.splice(this._observers.indexOf(observer), 1);
    }
    async runWith(def, variables) {
        this._updateState({ status: TaskStatus.RUNNING });
        const rollbackContext = def.handlers?.onStart?.(variables);
        try {
            const result = await def.execute(variables);
            this._updateState({
                status: TaskStatus.SUCCESS,
                data: def.persistent && def.getDataToPersist
                    ? def.getDataToPersist(result)
                    : null,
            });
            const resolvedResult = (await def.handlers?.onSuccess?.(result, variables, rollbackContext)) || result;
            def.handlers?.onComplete?.(variables);
            return resolvedResult;
        }
        catch (error) {
            this._updateState({ status: TaskStatus.ERROR, error });
            def.handlers?.onError?.(error, variables, rollbackContext);
            def.handlers?.onComplete?.(variables);
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
        this.state = { ...__defaultTaskState };
        this._observers.forEach((observer) => {
            observer(this.state);
        });
    }
    canBeDestroyed() {
        return (this._observers.length === 0 && this.state.status !== TaskStatus.RUNNING);
    }
    destroy() {
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
const taskManager = new TaskManager();
function getOrCreateTask(taskId) {
    if (!taskManager.has(taskId))
        taskManager.add(new Task(taskId));
    return taskManager.get(taskId);
}
function useTaskState(taskId) {
    const rerender = (0, use_rerender_1.default)();
    const task = getOrCreateTask(taskId);
    const observerRef = react_1.default.useRef(() => rerender());
    react_1.default.useEffect(() => {
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
exports.useTaskState = useTaskState;
const defaultTaskDef = {
    getDataToPersist: (data) => data,
    handlers: {
        onStart: () => void 0,
        onSuccess: () => void 0,
        onError: () => void 0,
        onComplete: () => void 0,
    },
};
function runTask(taskDef, variables) {
    const task = getOrCreateTask(taskDef.id);
    const actualDef = (0, defaultsDeep_1.default)(taskDef, defaultTaskDef);
    return task.runWith(actualDef, variables);
}
function usePerformTask(taskDef) {
    const perform = react_1.default.useCallback(async (variables) => {
        const result = [];
        try {
            const actualTaskDef = typeof taskDef === 'function' ? taskDef(variables) : taskDef;
            result[0] = await runTask(actualTaskDef, variables);
        }
        catch (error) {
            const error__ = error;
            if (error__.message) {
                if (error__.retryable) {
                    error__.retry = (function (variables_) {
                        return () => perform(variables_);
                    })(variables);
                }
            }
            result[1] = error__;
        }
        return result;
    }, [taskDef]);
    return perform;
}
exports.usePerformTask = usePerformTask;
function useTask(taskDef) {
    if (!taskDef.id) {
        throw new Error('task must have an id');
    }
    const state = useTaskState(taskDef.id);
    const perform = usePerformTask(taskDef);
    const reset = react_1.default.useCallback(() => {
        getOrCreateTask(taskDef.id).reset();
    }, [taskDef.id]);
    return {
        ...state,
        perform,
        reset,
    };
}
exports.useTask = useTask;
function useIsTaskRunning(taskId) {
    return useTaskState(taskId)?.isRunning;
}
exports.useIsTaskRunning = useIsTaskRunning;
//# sourceMappingURL=index.js.map