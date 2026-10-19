import { instrumentPerformance, type StopPerformanceInstrumentation } from "allure-node-performance";
import { afterEach, beforeEach } from "vite-plus/test";

let stop: StopPerformanceInstrumentation;

beforeEach(() => {
  stop = instrumentPerformance();
});

afterEach(async () => {
  await stop();
});
