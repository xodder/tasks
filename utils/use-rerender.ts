import React from 'react';

function useRerender() {
  const [, dispatch] = React.useReducer((c: number) => (c + 1) % 100, 0);
  const mountedRef = React.useRef(false);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return React.useCallback(() => {
    if (mountedRef.current) {
      dispatch();
    }
  }, []);
}

export default useRerender;
