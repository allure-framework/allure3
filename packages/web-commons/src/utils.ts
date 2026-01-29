import { type ReadonlySignal, type Signal, signal } from "@preact/signals-core";

const signalExample = signal(1);

/**
 * Checks if the value is a signal.
 */
export const isSignal = (value: unknown): value is Signal | ReadonlySignal => {
  return (
    typeof value === "object" &&
    value !== null &&
    "brand" in value &&
    typeof value.brand === "symbol" &&
    value.brand === signalExample.brand
  );
};
