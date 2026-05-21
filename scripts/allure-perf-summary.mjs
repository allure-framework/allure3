#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const phaseOrder = [
  "restoreState.total",
  "restoreState.dump",
  "restoreState.attachments",
  "restoreState.storeRestore",
  "generate.total",
  "generate.readResults",
  "generate.plugins.done",
  "publish.upload.total",
  "summary.generate",
];

const dynamicPhasePrefixes = ["generate.plugin.done.", "publish.upload.plugin."];

const parseArgs = (argv) => {
  const args = {
    metrics: argv[0],
    output: "",
  };

  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i] === "--output") {
      args.output = argv[i + 1] ?? "";
      i += 1;
    }
  }

  return args;
};

const formatMs = (value) => `${Number(value ?? 0).toFixed(1)} ms`;

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const validateSummaryRow = (row) =>
  isRecord(row) &&
  typeof row.name === "string" &&
  Number.isInteger(row.count) &&
  isFiniteNumber(row.totalMs) &&
  isFiniteNumber(row.avgMs) &&
  isFiniteNumber(row.minMs) &&
  isFiniteNumber(row.maxMs);

const validatePayload = (payload) => {
  if (!isRecord(payload)) {
    return "metrics payload must be a JSON object";
  }

  if (payload.version !== 1) {
    return `unsupported metrics schema version: ${String(payload.version ?? "missing")}`;
  }

  if (typeof payload.generatedAt !== "string") {
    return "metrics payload is missing generatedAt";
  }

  if (!Array.isArray(payload.summary)) {
    return "metrics payload summary must be an array";
  }

  const invalidRowIndex = payload.summary.findIndex((row) => !validateSummaryRow(row));

  if (invalidRowIndex !== -1) {
    return `metrics payload summary row ${invalidRowIndex} has an unsupported shape`;
  }

  return "";
};

const renderMarkdown = (metricsPath) => {
  const title = "### Allure perf metrics";

  if (!metricsPath || !existsSync(metricsPath)) {
    return `${title}\n\nMetrics file was not generated.\n`;
  }

  let payload;

  try {
    payload = JSON.parse(readFileSync(metricsPath, "utf8"));
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);

    return `${title}\n\nMetrics file could not be parsed: \`${details}\`.\n`;
  }

  const validationError = validatePayload(payload);

  if (validationError) {
    return `${title}\n\nMetrics file has an unsupported schema: \`${validationError}\`.\n`;
  }

  const byName = new Map(payload.summary.map((row) => [row.name, row]));
  const knownNames = new Set(phaseOrder);
  const dynamicRows = payload.summary
    .filter((row) => !knownNames.has(row.name) && dynamicPhasePrefixes.some((prefix) => row.name.startsWith(prefix)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const rows = [...phaseOrder.map((name) => byName.get(name)).filter(Boolean), ...dynamicRows];

  if (rows.length === 0) {
    return `${title}\n\nMetrics file contains no phase measurements.\n`;
  }

  return [
    title,
    "",
    `Generated at: \`${payload.generatedAt ?? "unknown"}\``,
    "",
    "| Phase | Count | Total | Avg | Min | Max |",
    "|---|---:|---:|---:|---:|---:|",
    ...rows.map(
      (row) =>
        `| \`${row.name}\` | ${row.count} | ${formatMs(row.totalMs)} | ${formatMs(row.avgMs)} | ${formatMs(row.minMs)} | ${formatMs(row.maxMs)} |`,
    ),
    "",
  ].join("\n");
};

const args = parseArgs(process.argv.slice(2));
const markdown = renderMarkdown(args.metrics ? resolve(args.metrics) : "");

if (args.output) {
  const outputPath = resolve(args.output);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, markdown, "utf8");
} else {
  process.stdout.write(markdown);
}
