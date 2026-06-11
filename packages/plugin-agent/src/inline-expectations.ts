import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { AgentExpectationUsageError, AgentUsageError } from "./errors.js";
import type { AgentAttachmentExpectationInput, AgentExpectationsInput } from "./model.js";
import { parseAgentExpectations } from "./model.js";
import { isPathInside } from "./paths.js";

type SingleStringOptionValue = string | string[] | undefined;

export type AgentInlineExpectationOptions = {
  goal?: SingleStringOptionValue;
  taskId?: SingleStringOptionValue;
  expectTests?: SingleStringOptionValue;
  expectLabels?: string[];
  expectEnvironments?: string[];
  expectFullNames?: string[];
  expectPrefixes?: string[];
  forbidLabels?: string[];
  expectStepContains?: string[];
  expectSteps?: SingleStringOptionValue;
  expectAttachments?: SingleStringOptionValue;
  expectAttachmentFilters?: string[];
};

const readNonNegativeInteger = (value: string | undefined, optionName: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new AgentExpectationUsageError(`${optionName} must be a non-negative integer`, optionName);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw new AgentExpectationUsageError(`${optionName} must be a non-negative integer`, optionName);
  }

  return parsed;
};

const readPositiveInteger = (value: string | undefined, optionName: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    throw new AgentExpectationUsageError(`${optionName} must be a positive integer`, optionName);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw new AgentExpectationUsageError(`${optionName} must be a positive integer`, optionName);
  }

  return parsed;
};

const readSingleStringOption = (value: SingleStringOptionValue, optionName: string): string | undefined => {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];

  if (values.length > 1) {
    throw new AgentExpectationUsageError(`Duplicate ${optionName} is not allowed`, optionName);
  }

  if (!values.length) {
    return undefined;
  }

  const normalized = values[0].trim();

  if (!normalized) {
    throw new AgentExpectationUsageError(`${optionName} value must be non-empty`, optionName);
  }

  return normalized;
};

const parseNameValue = (value: string, optionName: string, example: string) => {
  const parts = value.split("=");

  if (parts.length !== 2) {
    throw new AgentExpectationUsageError(
      `Invalid ${optionName} ${JSON.stringify(value)}. Expected ${example}`,
      optionName,
    );
  }

  const name = parts[0].trim();
  const filterValue = parts[1].trim();

  if (!name || !filterValue) {
    throw new AgentExpectationUsageError(
      `Invalid ${optionName} ${JSON.stringify(value)}. Expected ${example}`,
      optionName,
    );
  }

  return {
    name,
    value: filterValue,
  };
};

const addLabelValues = (target: Record<string, string[]>, values: string[] | undefined, optionName: string) => {
  for (const rawValue of values ?? []) {
    const { name, value } = parseNameValue(rawValue, optionName, "the form name=value, for example module=cli");
    const current = target[name] ?? [];

    if (!current.includes(value)) {
      current.push(value);
    }

    target[name] = current;
  }
};

const normalizeStringValues = (values: string[] | undefined, optionName: string) => {
  const normalized: string[] = [];

  for (const value of values ?? []) {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new AgentExpectationUsageError(`${optionName} value must be non-empty`, optionName);
    }

    normalized.push(trimmed);
  }

  return normalized;
};

export const buildAgentInlineExpectations = (
  options: AgentInlineExpectationOptions,
): AgentExpectationsInput | undefined => {
  const expectedLabels: Record<string, string[]> = {};
  const forbiddenLabels: Record<string, string[]> = {};
  const expected: NonNullable<AgentExpectationsInput["expected"]> = {};
  const forbidden: NonNullable<AgentExpectationsInput["forbidden"]> = {};
  const evidence: NonNullable<AgentExpectationsInput["evidence"]> = {};
  const attachmentFilters: AgentAttachmentExpectationInput[] = [];

  addLabelValues(expectedLabels, options.expectLabels, "--expect-label");
  addLabelValues(forbiddenLabels, options.forbidLabels, "--forbid-label");

  const expectTests = readNonNegativeInteger(
    readSingleStringOption(options.expectTests, "--expect-tests"),
    "--expect-tests",
  );
  const expectSteps = readPositiveInteger(
    readSingleStringOption(options.expectSteps, "--expect-steps"),
    "--expect-steps",
  );
  const expectAttachments = readPositiveInteger(
    readSingleStringOption(options.expectAttachments, "--expect-attachments"),
    "--expect-attachments",
  );
  const expectedEnvironments = normalizeStringValues(options.expectEnvironments, "--expect-env");
  const expectedFullNames = normalizeStringValues(options.expectFullNames, "--expect-test");
  const expectedPrefixes = normalizeStringValues(options.expectPrefixes, "--expect-prefix");
  const expectedStepContains = normalizeStringValues(options.expectStepContains, "--expect-step-containing");

  for (const rawValue of options.expectAttachmentFilters ?? []) {
    const parsed = rawValue.includes("=")
      ? parseNameValue(
          rawValue,
          "--expect-attachment",
          "a file name or a filter such as name=trace.zip or content-type=application/json",
        )
      : { name: "name", value: rawValue.trim() };
    const normalizedName = parsed.name.toLowerCase().replace(/_/g, "-");

    if (!parsed.value) {
      throw new AgentExpectationUsageError(
        "Invalid --expect-attachment value. Expected a non-empty file name or filter such as name=trace.zip",
        "--expect-attachment",
      );
    }

    if (normalizedName === "name") {
      attachmentFilters.push({ name: parsed.value });
      continue;
    }

    if (normalizedName === "content-type" || normalizedName === "type") {
      attachmentFilters.push({ content_type: parsed.value });
      continue;
    }

    throw new AgentExpectationUsageError(
      `Invalid --expect-attachment key ${JSON.stringify(parsed.name)}. Expected name or content-type`,
      "--expect-attachment",
    );
  }

  if (expectTests !== undefined) {
    expected.test_count = expectTests;
  }

  if (expectedEnvironments.length) {
    expected.environments = expectedEnvironments;
  }

  if (expectedFullNames.length) {
    expected.full_names = expectedFullNames;
  }

  if (expectedPrefixes.length) {
    expected.full_name_prefixes = expectedPrefixes;
  }

  if (Object.keys(expectedLabels).length) {
    expected.label_values = expectedLabels;
  }

  if (Object.keys(forbiddenLabels).length) {
    forbidden.label_values = forbiddenLabels;
  }

  if (expectSteps !== undefined) {
    evidence.min_steps = expectSteps;
  }

  if (expectAttachments !== undefined) {
    evidence.min_attachments = expectAttachments;
  }

  if (expectedStepContains.length) {
    evidence.step_name_contains = expectedStepContains;
  }

  if (attachmentFilters.length) {
    evidence.attachments = attachmentFilters;
  }

  if (
    expected.test_count === 0 &&
    (expected.environments?.length ||
      expected.full_names?.length ||
      expected.full_name_prefixes?.length ||
      Object.keys(expected.label_values ?? {}).length ||
      evidence.step_name_contains?.length ||
      evidence.min_steps !== undefined ||
      evidence.min_attachments !== undefined ||
      evidence.attachments?.length)
  ) {
    throw new AgentExpectationUsageError(
      "--expect-tests 0 cannot be combined with positive scope or evidence expectations",
      "--expect-tests",
    );
  }

  const inlineExpectations: AgentExpectationsInput = {
    ...(readSingleStringOption(options.goal, "--goal") ? { goal: readSingleStringOption(options.goal, "--goal") } : {}),
    ...(readSingleStringOption(options.taskId, "--task-id")
      ? { task_id: readSingleStringOption(options.taskId, "--task-id") }
      : {}),
    ...(Object.keys(expected).length ? { expected } : {}),
    ...(Object.keys(forbidden).length ? { forbidden } : {}),
    ...(Object.keys(evidence).length ? { evidence } : {}),
  };

  return Object.keys(inlineExpectations).length ? inlineExpectations : undefined;
};

export const validateAgentExpectationsFile = async (params: {
  cwd: string;
  output?: string;
  expectations?: string;
}) => {
  const { cwd, output, expectations } = params;

  if (!expectations) {
    return;
  }

  const expectationsPath = resolve(cwd, expectations);

  if (output) {
    const outputDir = resolve(cwd, output);

    if (isPathInside(outputDir, expectationsPath)) {
      throw new AgentUsageError(
        `--expectations path ${JSON.stringify(expectationsPath)} must not be inside the agent output directory ${JSON.stringify(outputDir)}`,
      );
    }
  }

  try {
    parseAgentExpectations(await readFile(expectationsPath, "utf-8"));
  } catch (error) {
    throw new AgentExpectationUsageError(
      `Could not load expectations from ${expectationsPath}: ${(error as Error).message}`,
      "--expectations",
    );
  }
};
