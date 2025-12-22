import { useCallback, useMemo } from "preact/hooks";
import { getColorScale } from "../utils";

export const useCoverageDiffColors = (theme: string = "light") => {
  const scale = useMemo(() => {
    return getColorScale([0, 1], ["var(--bg-support-capella)", "var(--bg-support-sirius)", "var(--bg-support-castor)"]);
  }, [theme]);

  return useCallback((value: number) => scale(value), [scale]);
};

export const useSuccessRateDistributionColors = (theme: string = "light") => {
  const scale = useMemo(() => {
    return getColorScale([0, 1], ["var(--bg-support-capella)", "var(--bg-support-castor)"]);
  }, [theme]);

  return useCallback((value: number) => scale(value), [scale]);
};

export const useCoverageDiffTextColors = (theme: string = "light") => {
  const scale = useMemo(() => {
    return getColorScale(
      [0, 1],
      ["var(--constant-on-text-primary)", "var(--on-text-primary)", "var(--constant-on-text-primary)"],
    );
  }, [theme]);

  return useCallback((value: number) => scale(value), [scale]);
};
