import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { TestLabel, TestPlan, TestPlanTest } from "@allurereport/core-api";
import {
  loadAgentOutput,
  planAgentEnrichmentReview,
  type AgentOutputBundle,
  type AgentTestManifestLine,
} from "@allurereport/plugin-agent";
import { UsageError } from "clipanion";

import { readLatestAgentState } from "./agent-state.js";

export type AgentRerunPreset = "review" | "failed" | "unsuccessful" | "all";

export type AgentLabelFilter = {
  name: string;
  value: string;
};

export type AgentSelectionResult = {
  outputDir: string;
  preset: AgentRerunPreset;
  selectedTests: AgentTestManifestLine[];
  testPlan: TestPlan;
};

export type AgentTestPlanContext = {
  outputDir: string;
  preset: AgentRerunPreset;
  selectedCount: number;
  testPlanPath: string;
  cleanup: () => Promise<void>;
};

const AGENT_RERUN_PRESETS: AgentRerunPreset[] = ["review", "failed", "unsuccessful", "all"];

const ALLURE_ID_LABEL = "ALLURE_ID";

const isAgentRerunPreset = (value: string): value is AgentRerunPreset =>
  AGENT_RERUN_PRESETS.includes(value as AgentRerunPreset);

const readAllureId = (labels: TestLabel[]) => labels.find((label) => label.name === ALLURE_ID_LABEL)?.value;

const matchesLabelFilters = (labels: TestLabel[], filters: AgentLabelFilter[]) =>
  filters.every((filter) => labels.some((label) => label.name === filter.name && label.value === filter.value));

const buildTestPlan = (tests: AgentTestManifestLine[]): TestPlan => {
  const seenSelectors = new Set<string>();
  const seenIds = new Set<string>();
  const selected: TestPlanTest[] = [];

  for (const test of tests) {
    const selector = test.full_name || undefined;
    const id = readAllureId(test.labels);

    if (selector && !seenSelectors.has(selector)) {
      seenSelectors.add(selector);
      if (id) {
        seenIds.add(id);
      }
      selected.push({
        selector,
        ...(id ? { id } : {}),
      });
      continue;
    }

    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      selected.push({ id });
    }
  }

  return {
    version: "1.0",
    tests: selected,
  };
};

const selectTestsByPreset = (output: AgentOutputBundle, preset: AgentRerunPreset): AgentTestManifestLine[] => {
  switch (preset) {
    case "review": {
      const review = planAgentEnrichmentReview(output);
      const targeted = new Set(review.rerun.targetedTests);

      return output.tests.filter((test) => targeted.has(test.full_name));
    }

    case "failed":
      return output.tests.filter((test) => test.status === "failed" || test.status === "broken");

    case "unsuccessful":
      return output.tests.filter((test) => test.status !== "passed");

    case "all":
      return output.tests;
  }
};

export const normalizeAgentRerunPreset = (value?: string): AgentRerunPreset => {
  if (!value) {
    return "review";
  }

  const normalized = value.trim().toLowerCase();

  if (!isAgentRerunPreset(normalized)) {
    throw new UsageError(
      `Invalid rerun preset ${JSON.stringify(value)}. Expected one of: ${AGENT_RERUN_PRESETS.join(", ")}`,
    );
  }

  return normalized;
};

export const parseAgentLabelFilters = (values?: string[]): AgentLabelFilter[] =>
  (values ?? []).map((value) => {
    const separatorIndex = value.indexOf("=");

    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
      throw new UsageError(
        `Invalid label filter ${JSON.stringify(value)}. Expected the form name=value, for example feature=checkout`,
      );
    }

    const name = value.slice(0, separatorIndex).trim();
    const filterValue = value.slice(separatorIndex + 1).trim();

    if (!name || !filterValue) {
      throw new UsageError(
        `Invalid label filter ${JSON.stringify(value)}. Expected the form name=value, for example feature=checkout`,
      );
    }

    return {
      name,
      value: filterValue,
    };
  });

export const resolveAgentSelectionOutputDir = async (params: {
  cwd: string;
  from?: string;
  latest?: boolean;
}): Promise<string> => {
  const { cwd, from, latest } = params;

  if (from && latest) {
    throw new UsageError("Use either --from or --latest, not both");
  }

  if (!from && !latest) {
    throw new UsageError("Expected either --from <path> or --latest");
  }

  if (from) {
    return resolve(cwd, from);
  }

  const latestState = await readLatestAgentState(cwd);

  if (!latestState) {
    throw new UsageError(`No latest agent output found for ${cwd}`);
  }

  return latestState.outputDir;
};

export const selectAgentTestPlan = async (params: {
  outputDir: string;
  preset?: AgentRerunPreset;
  environments?: string[];
  labelFilters?: AgentLabelFilter[];
}): Promise<AgentSelectionResult> => {
  const preset = params.preset ?? "review";
  const output = await loadAgentOutput(params.outputDir);
  const selectedTests = selectTestsByPreset(output, preset)
    .filter((test) => (params.environments?.length ? params.environments.includes(test.environment_id) : true))
    .filter((test) => (params.labelFilters?.length ? matchesLabelFilters(test.labels, params.labelFilters) : true));

  return {
    outputDir: output.outputDir,
    preset,
    selectedTests,
    testPlan: buildTestPlan(selectedTests),
  };
};

export const createAgentTestPlanContext = async (params: {
  cwd: string;
  from?: string;
  latest?: boolean;
  preset?: AgentRerunPreset;
  environments?: string[];
  labelFilters?: AgentLabelFilter[];
}): Promise<AgentTestPlanContext | undefined> => {
  const { from, latest } = params;

  if (!from && !latest) {
    return undefined;
  }

  const outputDir = await resolveAgentSelectionOutputDir({
    cwd: params.cwd,
    from,
    latest,
  });
  const selection = await selectAgentTestPlan({
    outputDir,
    preset: params.preset,
    environments: params.environments,
    labelFilters: params.labelFilters,
  });

  if (!selection.testPlan.tests.length) {
    throw new UsageError(
      `No tests matched rerun selection in ${selection.outputDir}. Adjust the preset or filters before rerunning.`,
    );
  }

  const tempDir = await mkdtemp(join(tmpdir(), "allure-agent-select-"));
  const testPlanPath = join(tempDir, "testplan.json");

  await writeFile(testPlanPath, `${JSON.stringify(selection.testPlan, null, 2)}\n`, "utf-8");

  return {
    outputDir: selection.outputDir,
    preset: selection.preset,
    selectedCount: selection.testPlan.tests.length,
    testPlanPath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
};
