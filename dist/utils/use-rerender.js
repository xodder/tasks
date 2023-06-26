"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
function useRerender() {
    const [, dispatch] = react_1.default.useReducer((c) => (c + 1) % 100, 0);
    const mountedRef = react_1.default.useRef(false);
    react_1.default.useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);
    return react_1.default.useCallback(() => {
        if (mountedRef.current) {
            dispatch();
        }
    }, []);
}
exports.default = useRerender;
//# sourceMappingURL=use-rerender.js.map