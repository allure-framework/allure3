import { useCallback, useEffect, useRef } from "preact/hooks";

const DEFAULT_TIMEOUT = 300;

const debounce = <T extends (...args: any[]) => void>(cb: T, timeout = DEFAULT_TIMEOUT) => {
  let timer: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      cb(...args);
    }, timeout);
  };
};

export const useDebouncedCallback = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  cb: T,
  timeout = DEFAULT_TIMEOUT,
) => {
  const cbRef = useRef(cb);

  useEffect(() => {
    cbRef.current = cb;
  }, [cb]);

  return useCallback(
    debounce((...args: Parameters<T>) => cbRef.current(...args), timeout),
    [timeout],
  );
};
