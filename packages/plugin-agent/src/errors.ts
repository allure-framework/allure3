export class AgentUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentUsageError";
  }
}

export class AgentExpectationUsageError extends AgentUsageError {
  readonly sourceOption?: string;

  constructor(message: string, sourceOption?: string) {
    super(message);
    this.name = "AgentExpectationUsageError";
    this.sourceOption = sourceOption;
  }
}

export const isAgentUsageError = (error: unknown): error is AgentUsageError => error instanceof AgentUsageError;

export const isAgentExpectationUsageError = (error: unknown): error is AgentExpectationUsageError =>
  error instanceof AgentExpectationUsageError;
