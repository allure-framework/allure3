import type { ReadonlySignal, Signal } from "@preact/signals-core";

/**
 * Checks if the value is a signal.
 */
export const isSignal = (value: unknown): value is Signal | ReadonlySignal => {
  return typeof value === "object" && value !== null && "brand" in value && typeof value.brand === "symbol";
};
