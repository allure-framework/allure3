export type HostStopRequest = {
  type: "stop";
  requestId: string;
};

export type HostTerminateRequest = {
  type: "terminate";
  requestId: string;
  exitCode?: number;
};

export type HostRequest = HostStopRequest | HostTerminateRequest;

export type HostRequestType = HostRequest["type"];

export type HostError = {
  type: "error";
  requestId?: string;
  operation: string;
  message: string;
  fatal: boolean;
  win32Error?: number;
};

export type HostRequestError = HostError & {
  requestId: string;
  fatal: false;
};

export type HostReadyEvent = {
  type: "ready";
  hostPid: number;
};

export type HostTargetStartedEvent = {
  type: "started";
  rootPid: number;
};

export type HostTargetCompletedEvent = {
  type: "completed";
  rootExitCode: number;
  reason: "normal" | "stopped" | "terminated";
};

export type HostResultType = "stopResult" | "terminationResult";

export type HostRequestResultBase<T extends HostResultType> = {
  type: T;
  requestId: string;
} & (
  | {
      success: true;
      error?: never;
    }
  | {
      success: false;
      error: HostRequestError;
    }
);

export type HostStopResult = HostRequestResultBase<"stopResult">;
export type HostTerminationResult = HostRequestResultBase<"terminationResult">;
export type HostRequestResult = HostStopResult | HostTerminationResult;

export type HostResponse =
  | HostReadyEvent
  | HostTargetStartedEvent
  | HostTargetCompletedEvent
  | HostStopResult
  | HostTerminationResult
  | HostError;
