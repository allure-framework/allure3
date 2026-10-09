import type { TestStatus } from "../../model.js";
import { FlakinessAlgorithm } from "./algorithm.js";

type QuadraturePoint = { value: number; weight: number };

const SIGNIFICANT_STATUSES = new Set<TestStatus>(["passed", "failed", "broken"]);

/** Gaussian quadrature for a normalized Beta distribution (Golub–Welsch/implicit QL). */
const betaQuadrature = (a: number, b: number, size: number): QuadraturePoint[] => {
  const diagonal = Array.from({ length: size }, (_, index) => {
    if (index === 0) {
      return a / (a + b);
    }
    const total = 2 * index + a + b - 2;
    return (1 + ((a - b) * (a + b - 2)) / (total * (total + 2))) / 2;
  });
  const offDiagonal = Array.from({ length: size }, (_, index) => {
    const n = index + 1;
    const total = 2 * n + a + b - 2;
    return index === size - 1
      ? 0
      : Math.sqrt((n * (n + a - 1) * (n + b - 1) * (n + a + b - 2)) / ((total - 1) * (total + 1))) / total;
  });
  const weights: number[] = Array.from({ length: size }, (_, index) => (index === 0 ? 1 : 0));

  for (let left = 0; left < size; left++) {
    while (true) {
      let right = left;
      while (
        right < size - 1 &&
        Math.abs(offDiagonal[right]) > Number.EPSILON * (Math.abs(diagonal[right]) + Math.abs(diagonal[right + 1]))
      ) {
        right++;
      }
      if (right === left) {
        break;
      }
      let g = (diagonal[left + 1] - diagonal[left]) / (2 * offDiagonal[left]);
      const radius = Math.hypot(g, 1);
      g = diagonal[right] - diagonal[left] + offDiagonal[left] / (g + (g < 0 ? -radius : radius));
      let sine = 1;
      let cosine = 1;
      let shift = 0;
      for (let index = right - 1; index >= left; index--) {
        const f = sine * offDiagonal[index];
        const old = cosine * offDiagonal[index];
        const norm = Math.hypot(f, g);
        offDiagonal[index + 1] = norm;
        sine = f / norm;
        cosine = g / norm;
        g = diagonal[index + 1] - shift;
        const rotation = (diagonal[index] - g) * sine + 2 * cosine * old;
        shift = sine * rotation;
        diagonal[index + 1] = g + shift;
        g = cosine * rotation - old;
        const weight = weights[index + 1];
        weights[index + 1] = sine * weights[index] + cosine * weight;
        weights[index] = cosine * weights[index] - sine * weight;
      }
      diagonal[left] -= shift;
      offDiagonal[left] = g;
      offDiagonal[right] = 0;
    }
  }
  return diagonal.map((value, index) => ({ value, weight: weights[index] ** 2 })).sort((x, y) => x.value - y.value);
};

const logSumExp = (values: number[]): number => {
  const maximum = Math.max(...values);
  return maximum + Math.log(values.reduce((sum, value) => sum + Math.exp(value - maximum), 0));
};

const estimatePosterior = (runs: TestStatus[][]): number => {
  let failures = 0;
  let passes = 0;
  let goodRuns = 0;
  let allFailingRuns = 0;
  let allFailingAttempts = 0;
  const failingRunLengths = new Map<number, number>();
  for (const run of runs) {
    const outcomes = run.filter((status) => SIGNIFICANT_STATUSES.has(status));
    const successes = outcomes.filter((status) => status === "passed").length;
    if (successes > 0) {
      goodRuns++;
      passes += successes;
      failures += outcomes.length - successes;
    } else {
      allFailingRuns++;
      allFailingAttempts += outcomes.length;
      failingRunLengths.set(outcomes.length, (failingRunLengths.get(outcomes.length) ?? 0) + 1);
    }
  }

  // Passing runs must be in a good state. Absorb their likelihood into the
  // Beta(1, 19) flakiness prior and the uniform Beta(1, 1) bad-state prior.
  const a = failures + 1;
  const b = passes + 19;
  if (allFailingRuns === 0) {
    return a / (a + b);
  }
  // Remaining likelihood is polynomial: these orders integrate its normalizer
  // and first moment exactly in exact arithmetic, without a fixed grid cutoff.
  const pPoints = betaQuadrature(a, b, Math.max(64, Math.ceil((allFailingAttempts + 2) / 2)));
  const qPoints = betaQuadrature(1, goodRuns + 1, Math.max(1, Math.ceil((allFailingRuns + 1) / 2)));
  const lengths = [...failingRunLengths];
  const logs = pPoints.map(({ value: p, weight }) => {
    const marginal = logSumExp(
      qPoints.map(({ value: q, weight: qWeight }) =>
        lengths.reduce((sum, [length, count]) => sum + count * Math.log(q + (1 - q) * p ** length), Math.log(qWeight)),
      ),
    );
    return Math.log(weight) + marginal;
  });
  const normalizer = logSumExp(logs);
  const posterior = pPoints.map(({ value }, index) => ({ value, weight: Math.exp(logs[index] - normalizer) }));
  return posterior.reduce((sum, point) => sum + point.value * point.weight, 0);
};

export class PfsFlakinessAlgorithm extends FlakinessAlgorithm {
  isFlaky(): boolean | undefined {
    const score = this.#getScore();
    return score === undefined ? undefined : score > (this.options.pfsThreshold ?? 0.1);
  }

  #getScore(): number | undefined {
    const { current, history } = this;
    const { historyDepth = 10, stabilizationPeriod = 5 } = this.options;
    if (historyDepth === -1 || !SIGNIFICANT_STATUSES.has(current.status)) {
      return undefined;
    }
    const runs: TestStatus[][] = [];
    for (const result of history) {
      if (result === undefined) {
        break;
      }
      if (result.id === current.id || !SIGNIFICANT_STATUSES.has(result.status)) {
        continue;
      }
      runs.push([...(result.retries ?? []), result.status]);
      if (historyDepth > 0 && runs.length === historyDepth) {
        break;
      }
    }
    runs.reverse();
    runs.push([...(current.retries ?? []).map((retry) => retry.status).reverse(), current.status]);

    const period = historyDepth > 0 ? Math.min(stabilizationPeriod, historyDepth + 1) : stabilizationPeriod;
    let anchor = 0;
    let streak = 0;
    for (let index = 0; index < runs.length; index++) {
      streak = index > 0 && runs[index].join(",") === runs[index - 1].join(",") ? streak + 1 : 1;
      if (streak >= period) {
        anchor = index - streak + 1;
      }
    }
    const window = runs.slice(anchor);
    const attempts = window.reduce(
      (sum, run) => sum + run.filter((status) => SIGNIFICANT_STATUSES.has(status)).length,
      0,
    );
    return attempts < 2 ? undefined : estimatePosterior(window);
  }
}
