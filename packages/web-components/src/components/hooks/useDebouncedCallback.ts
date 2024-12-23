import { useCallback, useEffect, useRef } from "preact/hooks";

const DEFAULT_TIMEOUT = 300;

function debounce(cb: () => void, timeout = DEFAULT_TIMEOUT) {
  let timer: ReturnType<typeof setTimeout>;

  return (...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // @ts-ignore
      cb.apply(this, args);
    }, timeout);
  };
}

export const useDebouncedCallback = <Callback extends (...args: unknown[]) => void>(
  cb: Callback,
  timeout = DEFAULT_TIMEOUT,
) => {
  const cbRef = useRef(cb);

  cbRef.current = cb;

  useEffect(() => {
    return () => {
      cbRef.current = (() => {}) as Callback;
    };
  }, []);

  return useCallback<Callback>(debounce((...args) => cbRef.current(...args), timeout) as Callback, [timeout]);
};
