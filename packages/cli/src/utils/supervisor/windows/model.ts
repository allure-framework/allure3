export type StopRequest = {
  type: "stop";
  requestId: string;
};

export type TerminateRequest = {
  type: "terminate";
  requestId: string;
  exitCode?: number;
};

export type SupervisorRequest = StopRequest | TerminateRequest;

export type RequestType = SupervisorRequest["type"];

export type SupervisorError = {
  type: "error";
  requestId?: string;
  operation: string;
  message: string;
  fatal: boolean;
  win32Error?: number;
};

export type RequestError = SupervisorError & {
  requestId: string;
  fatal: false;
};

export type ReadyEvent = {
  type: "ready";
  supervisorPid: number;
};

export type StartedEvent = {
  type: "started";
  rootPid: number;
};

export type CompletedEvent = {
  type: "completed";
  rootExitCode: number;
  reason: "normal" | "stopped" | "terminated";
};

export type ResultType = "stopResult" | "terminationResult";

export type RequestResultBase<T extends ResultType> = {
  type: T;
  requestId: string;
} & (
  | {
      success: true;
      error?: never;
    }
  | {
      success: false;
      error: RequestError;
    }
);

export type StopResult = RequestResultBase<"stopResult">;
export type TerminationResult = RequestResultBase<"terminationResult">;
export type RequestResult = StopResult | TerminationResult;

export type SupervisorResponse =
  | ReadyEvent
  | StartedEvent
  | CompletedEvent
  | StopResult
  | TerminationResult
  | SupervisorError;
