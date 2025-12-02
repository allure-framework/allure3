import { useCallback, useMemo, useState } from "preact/hooks";
import type { TimelineData } from "../types.js";

export const useDurationRange = (data: TimelineData) => {
  const durationDomain = useMemo(() => {
    const result = data.reduce(
      (domain, group) => {
        const durations = group.segments.map((segment) => segment.val);

        return {
          min: Math.min(domain.min, ...durations),
          max: Math.max(domain.max, ...durations),
        };
      },
      {
        min: Infinity,
        max: -Infinity,
      },
    );

    return [result.min, result.max] as const;
  }, [data]);

  const [minDuration, setMinDuration] = useState<number>(durationDomain[0]);
  const [maxDuration, setMaxDuration] = useState<number>(durationDomain[1]);

  const handleDurationChange = useCallback((min: number, max: number) => {
    setMinDuration(min);
    setMaxDuration(max);
  }, []);

  return { durationRange: [minDuration, maxDuration] as const, handleDurationChange, durationDomain };
};
