export type SupervisedCommandOptions = {
  arguments?: readonly string[];
  workingDirectory?: string;
  environmentVariables?: Record<string, string>;
  stdio?: "ignore" | "inherit" | "pipe";
  outputEncoding?: BufferEncoding;
  silent?: boolean;
  stopTimeout?: number;
};

export type ProcessStartupInfo = {
  pid: number;
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
  wait(): Promise<ProcessCompletion | undefined>;
  dispose?(): void;
};

export type RootCompletion = ProcessCompletion & {
  spawned: boolean;
  error?: Error;
};
