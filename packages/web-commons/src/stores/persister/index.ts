import { type Signal, effect } from "@preact/signals-core";

export const persistSignal = <S extends Signal<unknown>>(options: {
  signal: S;
  key: string;
  shouldPersist?: (v: S extends Signal<infer U> ? U : never) => boolean;
}) => {
  if (typeof window === "undefined") {
    return;
  }

  const { signal, key, shouldPersist = () => true } = options;

  return effect(() => {
    const value = signal.value;

    if (!shouldPersist(value as any)) {
      return;
    }

    try {
      window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch {}
  });
};

export const restoreSignal = <S extends Signal<unknown>, V = S extends Signal<infer U> ? U : unknown>(options: {
  signal: S;
  key: string;
  defaultValue?: V;
  onRestore?: (value: any) => V | undefined;
}) => {
  if (typeof window === "undefined") {
    return;
  }

  const { signal, key, defaultValue, onRestore = (v) => v as V } = options;

  const value = window.localStorage.getItem(key);

  if (value !== null) {
    let parsedValue = value as V;
    try {
      parsedValue = JSON.parse(value) as V;
    } catch {}
    signal.value = onRestore(parsedValue);
    return;
  }

  if ("defaultValue" in options) {
    signal.value = defaultValue;
  }
};
