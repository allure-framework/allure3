export type MetricBetter = "lower" | "higher" | "neutral";

export interface MetricSample {
  key: string;
  value: number;
  unit?: string;
  name?: string;
  group?: string;
  timestamp?: number;
  tags?: Record<string, string>;
  source?: string;
  better?: MetricBetter;
  display?: {
    history?: boolean;
  };
}
