import { spawn } from "node:child_process";
import { readFile, rm, stat } from "node:fs/promises";

const reportDirectory = new URL("../out/demo/", import.meta.url);
const qualityGateWidget = new URL("widgets/quality-gate.json", reportDirectory);
const metricsWidget = new URL("widgets/metrics.json", reportDirectory);
const summaryFile = new URL("summary.json", reportDirectory);
const resultsDirectory = process.env.ALLURE_RESULTS_DIR ?? "../sandbox/allure-results";

const runAllure = async () =>
  new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "yarn.cmd" : "yarn";
    const child = spawn(
      command,
      ["run", "-T", "allure", "generate", resultsDirectory, "--config=./allurerc-dev.mjs", "--output=./out/demo"],
      { stdio: "inherit" },
    );

    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });

const isCompletedReportWithFailedQualityGate = async () => {
  try {
    const [qualityGate, summary] = await Promise.all([
      readFile(qualityGateWidget, "utf8").then(JSON.parse),
      readFile(summaryFile, "utf8").then(JSON.parse),
      stat(metricsWidget),
    ]);
    const results = Object.values(qualityGate).flat();

    return summary.pluginId === "awesome" && results.some(({ success }) => !success);
  } catch {
    return false;
  }
};

await rm(reportDirectory, { recursive: true, force: true });

const { code, signal } = await runAllure();

if (code === 0) {
  process.exit(0);
}

if (code === 1 && (await isCompletedReportWithFailedQualityGate())) {
  console.warn("The development report contains expected failed quality gates; continuing to start the server.");
  process.exit(0);
}

console.error(signal ? `Allure generation stopped by ${signal}.` : `Allure generation failed with exit code ${code}.`);
process.exit(code ?? 1);
