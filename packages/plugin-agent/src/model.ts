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

export type AgentPluginOptions = {
  outputDir?: string;
  expectationsPath?: string;
  expectations?: AgentExpectationsInput;
  command?: string;
  agentName?: string;
  loopId?: string;
  taskId?: string;
  conversationId?: string;
};

export const parseAgentExpectations = (rawContent: string): AgentExpectationsInput => {
  const parsed = parse(rawContent) as AgentExpectationsInput;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a YAML or JSON object");
  }

  return parsed;
};
