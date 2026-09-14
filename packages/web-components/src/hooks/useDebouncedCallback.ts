import { useCallback, useEffect, useRef } from "preact/hooks";

const DEFAULT_TIMEOUT = 300;

type Debounced<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
};

const debounce = <T extends (...args: any[]) => void>(cb: T, timeout = DEFAULT_TIMEOUT): Debounced<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const fn = ((...args: Parameters<T>) => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = undefined;
      cb(...args);
    }, timeout);
  }) as Debounced<T>;

  fn.cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return fn;
};

export const useDebouncedCallback = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  cb: T,
  timeout = DEFAULT_TIMEOUT,
): Debounced<T> => {
  const cbRef = useRef(cb);

  useEffect(() => {
    cbRef.current = cb;
  }, [cb]);

  const debounced = useCallback(
    debounce((...args: Parameters<T>) => cbRef.current(...args), timeout),
    [timeout],
  );

  useEffect(() => {
    return () => {
      debounced.cancel();
    };
  }, [debounced]);

  return debounced;
};
