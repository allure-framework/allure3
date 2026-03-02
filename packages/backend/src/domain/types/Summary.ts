import type { Statistic } from './Statistic.js';

export interface Summary {
  statistic: Statistic;
  duration: number;
  flakyCount: number;
  retriesCount: number;
}
