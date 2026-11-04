import type { Logger } from "@allurereport/cli-commons";

export type SupervisedCommandOptions = {
  logger?: Logger;
  arguments?: readonly string[];
  workingDirectory?: string;
  environmentVariables?: Record<string, string>;
  outputMode?: "ignore" | "inherit" | "pipe";
  outputEncoding?: BufferEncoding;
  silent?: boolean;
};

export type ProcessStartupInfo = {
  pid: number;
};

export type StopOptions = {
  escalate?: boolean;
  escalationTimeout?: number;
};

export type InterruptionLevel = "stopped" | "terminated";

export type ProcessCompletion = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

export type ProcessGroupCompletion = ProcessCompletion & {
  externalInterruption: "stopped" | "terminated" | undefined;
};

export type JobMonitor = {
  wait(rootCompletion: ProcessCompletion): Promise<ProcessCompletion | undefined>;
  dispose?(): Promise<void> | void;
};

export type RootCompletion = ProcessCompletion & {
  spawned: boolean;
  error?: Error;
};
