import { parse } from "yaml";

export type AgentExpectationSelectorInput = {
  environments?: string[];
  full_names?: string[];
  full_name_prefixes?: string[];
  label_values?: Record<string, string | string[]>;
  test_count?: number;
};

export type AgentAttachmentExpectationInput = {
  name?: string;
  content_type?: string;
};

export type AgentEvidenceExpectationInput = {
  required?: boolean;
  min_steps?: number;
  min_attachments?: number;
  step_name_contains?: string[];
  attachments?: AgentAttachmentExpectationInput[];
};

export type AgentExpectationsInput = {
  goal?: string;
  task_id?: string;
  expected?: AgentExpectationSelectorInput;
  forbidden?: AgentExpectationSelectorInput;
  evidence?: AgentEvidenceExpectationInput;
  notes?: string | string[];
};

export type AgentHumanReportMode = "auto" | "off" | "awesome" | "config";

export type AgentHumanReportStatusName = "pending" | "disabled" | "skipped" | "generated" | "failed";

export type AgentHumanReportEntry = {
  plugin_id: string;
  path: string;
};

export type AgentHumanReportError = {
  plugin_id?: string;
  message: string;
};

export type AgentHumanReportStatus = {
  schema_version: "allure-agent-human-report/v1";
  mode: AgentHumanReportMode;
  status: AgentHumanReportStatusName;
  result_count: number | null;
  threshold: number;
  path: string | null;
  reports: AgentHumanReportEntry[];
  reason: string | null;
  error: string | null;
  errors?: AgentHumanReportError[];
  generated_at?: string;
};

export type AgentHumanReportStatusProvider =
  | AgentHumanReportStatus
  | (() => AgentHumanReportStatus | undefined | Promise<AgentHumanReportStatus | undefined>);

export type AgentPluginOptions = {
  outputDir?: string;
  expectationsPath?: string;
  expectations?: AgentExpectationsInput;
  command?: string;
  agentName?: string;
  loopId?: string;
  taskId?: string;
  conversationId?: string;
  humanReport?: AgentHumanReportStatusProvider;
};

export const parseAgentExpectations = (rawContent: string): AgentExpectationsInput => {
  const parsed = parse(rawContent) as AgentExpectationsInput;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a YAML or JSON object");
  }

  return parsed;
};
