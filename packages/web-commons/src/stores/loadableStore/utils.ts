import { LOADABLE_STORE_BRAND } from "./constants.js";
import type { LoadableStore } from "./store.js";

export const isLoadableStore = <T>(value: unknown): value is LoadableStore<T> => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "brand" in value && value.brand === LOADABLE_STORE_BRAND;
};
