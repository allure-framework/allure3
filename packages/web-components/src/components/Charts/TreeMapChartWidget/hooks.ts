import { useCallback, useMemo } from "preact/hooks";

import { getColorScale } from "../utils";

export const useCoverageDiffColors = (theme: string = "light") => {
  const scale = useMemo(() => {
    return getColorScale(
      [0, 1],
      [
        "var(--color-status-failed-chart-fill)",
        "var(--color-intent-info-bg)",
        "var(--color-status-passed-chart-fill)",
      ],
    );
  }, [theme]);

  return useCallback((value: number) => scale(value), [scale]);
};

export const useSuccessRateDistributionColors = (theme: string = "light") => {
  const scale = useMemo(() => {
    return getColorScale([0, 1], ["var(--color-status-failed-chart-fill)", "var(--color-status-passed-chart-fill)"]);
  }, [theme]);

  return useCallback((value: number) => scale(value), [scale]);
};

export const useCoverageDiffTextColors = (theme: string = "light") => {
  const scale = useMemo(() => {
    return getColorScale(
      [0, 1],
      ["var(--color-text-inverse)", "var(--color-text-primary)", "var(--color-text-inverse)"],
    );
  }, [theme]);

  return useCallback((value: number) => scale(value), [scale]);
};
