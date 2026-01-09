import type { ReadonlySignal } from "@preact/signals";

export type LoadableStoreValue<T> = {
  error: ReadonlySignal<Error | undefined>;
  errorMessage: ReadonlySignal<string | undefined>;
  loading: ReadonlySignal<boolean>;
  data: ReadonlySignal<T>;
};
