import { batch, computed, signal } from "@preact/signals";
import { LOADABLE_STORE_BRAND } from "./constants.js";
import type { LoadableStoreValue } from "./types.js";

export type LoadableStore<T> = ReturnType<typeof loadableStore<T>>;

export const loadableStore = <T>(options: { initialState: T }) => {
  // Initial state
  const loadingSignal = signal(false);
  const errorSignal = signal<Error | undefined>(undefined);
  const dataSignal = signal<T>(options.initialState);

  return {
    // Exposed readonly state
    value: {
      data: computed(() => dataSignal.value),
      loading: computed(() => loadingSignal.value),
      error: computed(() => errorSignal.value),
      errorMessage: computed(() => {
        if (errorSignal.value) {
          return errorSignal.value.message;
        }

        return undefined;
      }),
    } as LoadableStoreValue<T>,
    /**
     * Initialize the store
     */
    onInit: () => {
      batch(() => {
        loadingSignal.value = false;
        errorSignal.value = undefined;
        dataSignal.value = options.initialState;
      });
    },
    /**
     * Start loading the data
     *
     * @param silent - whether to trigger the loading state
     */
    onLoad: (silent = false) => {
      batch(() => {
        loadingSignal.value = !silent;
        errorSignal.value = undefined;
      });
    },
    /**
     * Successfully loaded the data
     */
    onSuccess: (data: T) => {
      batch(() => {
        loadingSignal.value = false;
        errorSignal.value = undefined;
        dataSignal.value = data;
      });
    },
    /**
     * Error loading the data
     */
    onError: (error: Error = new Error("Unknown error")) => {
      batch(() => {
        loadingSignal.value = false;
        errorSignal.value = error;
      });
    },
    brand: LOADABLE_STORE_BRAND,
  } as const;
};
