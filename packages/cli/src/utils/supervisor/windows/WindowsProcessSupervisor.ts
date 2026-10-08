import type { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer, type Socket, type Server } from "node:net";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  type Unknown,
  type ShallowKnown,
  isObject,
  ensureBoolean,
  ensureInt,
  isBoolean,
  isString,
  ensureString,
} from "@allurereport/reader-api";
import { KnownError } from "@allurereport/service";

import { logError } from "../../logs.js";
import type { JobMonitor, SupervisedCommandOptions, ProcessCompletion, ProcessStartupInfo } from "../model.js";
import { ProcessSupervisorBase } from "../ProcessSupervisorBase.js";
import { SupervisorOperationError } from "./error.js";
import type {
  ResultType,
  RequestResult,
  SupervisorError,
  SupervisorRequest,
  SupervisorResponse,
  CompletedEvent,
  StartedEvent,
} from "./model.js";

type PendingRequest = {
  expectedType: ResultType;
  resolve: () => void;
  reject: (error: Error) => void;
};

const MAX_MESSAGE_BYTES = 1048576;
const START_TIMEOUT = 30_000;
const REQUEST_RESPONSE_TIMEOUT = 3_000;

const scriptPath = fileURLToPath(new URL("./supervisor.ps1", import.meta.url));

const getPowerShellPath = () => {
  const systemRoot = process.env.SystemRoot || process.env.windir;
  if (!systemRoot) {
    throw new KnownError("The 'SystemRoot' environment variable is not defined.");
  }

  return path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
};

const encode = (message: SupervisorRequest): Buffer => {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  if (!payload.length || payload.length > MAX_MESSAGE_BYTES) {
    throw new Error("Invalid frame size.");
  }

  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length);

  return Buffer.concat([header, payload]);
};

const decode = (socket: Socket, onMessage: (message: ShallowKnown<SupervisorResponse>) => void) => {
  let pending = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    pending = Buffer.concat([pending, chunk]);

    try {
      while (pending.length >= 4) {
        const size = pending.readUInt32LE(0);
        if (!size || size > MAX_MESSAGE_BYTES) {
          throw new Error("Invalid frame size.");
        }

        if (pending.length < size + 4) {
          break;
        }

        const text = new TextDecoder("utf-8", { fatal: true }).decode(pending.subarray(4, size + 4));

        pending = pending.subarray(size + 4);

        const message: Unknown<SupervisorResponse> = JSON.parse(text);
        if (isObject(message)) {
          onMessage(message);
        } else {
          throw new Error("The message is not an object.");
        }
      }
    } catch (error) {
      socket.destroy(error as Error);
    }
  });
  socket.on("end", () => {
    if (pending.length) {
      socket.destroy(new Error("Truncated frame."));
    }
  });
};

export class WindowsProcessSupervisor extends ProcessSupervisorBase {
  protected readonly shell: boolean = false;
  protected readonly detached: boolean = false;

  protected readonly monitor: JobMonitor;

  #server: Server | undefined;
  #control: Socket | undefined;
  #wrapper: ChildProcess | undefined;
  #failed: boolean = false;
  #failure: unknown;

  #started: boolean = false;
  #startupInfo: ProcessStartupInfo | undefined;
  #startedPromise: Promise<number>;
  #resolveStartedPromise!: (value: number) => void;
  #rejectStartedPromise!: (reason: unknown) => void;

  #completed: boolean = false;
  #jobCompletion: Promise<ProcessCompletion>;
  #resolveJobCompletion!: (value: ProcessCompletion) => void;
  #rejectJobCompletion!: (reason: unknown) => void;

  #pipePath: string;

  #pendingRequests = new Map<string, PendingRequest>();

  #manualStopController: AbortController | undefined;

  constructor(command: string, options: SupervisedCommandOptions) {
    const pipeName = `ps-supervisor-${randomUUID()}`;
    const pipePath = `\\\\.\\pipe\\${pipeName}`;

    super(getPowerShellPath(), {
      ...options,
      arguments: [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        pipeName,
        command,
        ...(options.arguments ?? []),
      ],
    });
    this.#pipePath = pipePath;

    this.monitor = {
      wait: async () => {
        return await this.#jobCompletion;
      },
      dispose: () => {
        this.#disposeControl();

        // Use the default Node.js SIGINT handler from now on.
        process.off("SIGINT", this.#onSigint);
      },
    };

    this.#startedPromise = new Promise<number>((resolve, reject) => {
      this.#resolveStartedPromise = resolve;
      this.#rejectStartedPromise = reject;
    });

    this.#jobCompletion = new Promise<ProcessCompletion>((resolve, reject) => {
      this.#resolveJobCompletion = resolve;
      this.#rejectJobCompletion = reject;
    });

    // These promises can reject before startup/completion callers subscribe.
    // Observe them immediately without replacing the original rejecting promises.
    void this.#startedPromise.catch(() => {});
    void this.#jobCompletion.catch(() => {});
  }

  override async start() {
    if (this.#server) {
      throw new Error("The controller has already been started.");
    }

    process.on("SIGINT", this.#onSigint);

    this.#server = createServer((socket) => {
      if (this.#control || this.#failed) {
        socket.destroy();
        return;
      }

      this.#control = socket;

      socket.on("error", (error) => {
        this.#fail(error);
      });

      decode(socket, (message) => {
        const { type } = message;
        switch (type) {
          case "completed":
            this.#handleCompletedMessage(message);
            break;

          case "started":
            this.#handleStartedMessage(message);
            break;

          case "stopResult":
          case "terminationResult":
            this.#handleRequestResultMessage(type, message);
            break;

          case "error":
            this.#handleErrorMessage(message);
            break;
        }
      });

      socket.on("close", () => {
        if (!this.#completed || !this.#started) {
          this.#fail(new Error("Control connection closed before startup or completion."));
        }

        this.#disposeControl();
      });
    });

    this.#server.on("error", (error) => this.#fail(error));

    try {
      await new Promise<void>((resolve, reject) => {
        this.#server!.once("error", reject);
        this.#server!.listen(this.#pipePath, resolve);
      });

      // Cancellation while the pipe was being opened must not launch a wrapper.
      if (this.#failed) {
        this.#disposeControl();
        throw this.#failure;
      }

      // Base startup creates the child and completion promise synchronously.
      const startup = super.start();
      if (this.started) {
        this.#wrapper = this.process;
        void this.completion.catch((error: unknown) => this.#fail(error));
        this.#wrapper.once("error", (error) => this.#fail(error));
        this.#wrapper.once("close", (code, signal) => {
          // An established socket must drain: its completed frame may arrive
          // after the wrapper closes. Without a connection no frame can arrive.
          if (!this.#control) {
            this.#fail(new Error(`Supervisor exited before connecting (code ${code}, signal ${signal}).`));
          }
        });
      }

      await startup;
      await this.#waitForStartReport();
    } catch (error) {
      this.#fail(error);
      throw error;
    }
  }

  protected override getStartupInfo(): ProcessStartupInfo | undefined {
    return this.#startupInfo;
  }

  protected override async requestRootStop(signal: AbortSignal) {
    const control = this.#getRequestControl();
    if (!control) {
      return;
    }

    let onAbort!: () => void;

    signal.throwIfAborted();

    const requestId = randomUUID();
    const response = new Promise<void>((resolve, reject) => {
      this.#pendingRequests.set(requestId, { resolve, reject, expectedType: "stopResult" });
    });

    // Follow the graceful stop timeout policy defined by the base class.
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
    });

    try {
      const message = encode({ type: "stop", requestId });
      control.write(message);
      if (signal.aborted) {
        return;
      }

      await Promise.race([response, aborted]);
    } finally {
      signal.removeEventListener("abort", onAbort);
      this.#pendingRequests.delete(requestId);
    }
  }

  protected override async requestTermination() {
    const control = this.#getRequestControl();
    if (!control) {
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;
    const requestId = randomUUID();
    const response = new Promise<void>((resolve, reject) => {
      this.#pendingRequests.set(requestId, { resolve, reject, expectedType: "terminationResult" });
    });
    try {
      control.write(encode({ type: "terminate", requestId }));
      await Promise.race([
        response,
        delay(REQUEST_RESPONSE_TIMEOUT, undefined, { signal }).then(() => {
          throw new KnownError(`Timed out waiting for the terminate request to complete.`);
        }),
      ]);
    } catch (error) {
      this.#fail(error);
      throw error;
    } finally {
      this.#pendingRequests.delete(requestId);
      abortController.abort();
    }
  }

  readonly #onSigint = () => {
    if (!this.#started) {
      // The target may not exist yet and cannot reliably receive this interrupt.
      // Abort startup without depending on the control connection being ready.
      this.#fail(new KnownError("Allure run startup cancelled by Ctrl+C."));
      return;
    }

    if (!this.#manualStopController) {
      this.#manualStopController = new AbortController();
      const signal = this.#manualStopController.signal;
      this.requestRootStop(signal).catch((error) => {
        this.#reportSupervisorError(
          "Unable to gracefully stop the process. Press CTRL+C again to force termination.",
          error,
        );
      });
      return;
    }

    // Removing the handler so the third SIGINT will use the default Node.js handler,
    // which terminates Allure.
    process.off("SIGINT", this.#onSigint);

    this.#manualStopController.abort("Termination forced.");

    // The second SIGINT terminates the entire job.
    // Allure has a chance to complete the report generation.
    void this.terminate().catch((error) => {
      this.#fail(error);
    });
  };

  #handleCompletedMessage(message: ShallowKnown<CompletedEvent>) {
    const exitCode = ensureInt(message.rootExitCode);
    if (exitCode === undefined) {
      this.#fail(new Error("Root exit code is undefined."));
    } else {
      this.#completed = true;
      for (const pendingRequest of this.#pendingRequests.values()) {
        pendingRequest.resolve();
      }
      this.#resolveJobCompletion({ code: exitCode, signal: null });
    }
  }

  #handleStartedMessage(message: ShallowKnown<StartedEvent>) {
    const rootPid = ensureInt(message.rootPid);
    if (rootPid === undefined) {
      this.#fail(new Error("Root PID is undefined."));
    } else {
      this.#started = true;
      this.#resolveStartedPromise(rootPid);
      this.#startupInfo = { pid: rootPid };
    }
  }

  #handleRequestResultMessage(type: string, message: ShallowKnown<RequestResult>) {
    const { requestId, success } = message;

    if (!isString(requestId) || !requestId.trim() || !isBoolean(success)) {
      this.#fail(new Error(`Invalid ${type} message from the process supervisor.`));
      return;
    }

    const pendingRequest = this.#pendingRequests.get(requestId);
    if (!pendingRequest) {
      // A response can arrive after the request has been retired during shutdown.
      this.#reportSupervisorError(`No pending ${type} request found for requestId ${requestId}.`);
      return;
    }

    if (pendingRequest.expectedType !== type) {
      this.#fail(
        new Error(`Expected ${pendingRequest.expectedType} for requestId ${requestId}, but received ${type}.`),
      );
      return;
    }

    if (success) {
      pendingRequest.resolve();
    } else {
      const { error } = message;
      if (!isObject(error)) {
        this.#fail(new Error(`Invalid error object in ${type} message from the process supervisor.`));
        return;
      }

      const supervisorError = this.#createSupervisorError(error);
      pendingRequest.reject(supervisorError);
    }
  }

  #handleErrorMessage(message: ShallowKnown<SupervisorError>) {
    const supervisorError = this.#createSupervisorError(message);

    const { requestId } = message;
    if (isString(requestId)) {
      const pendingRequest = this.#pendingRequests.get(requestId);
      if (pendingRequest) {
        pendingRequest.reject(supervisorError);
      }
    }

    if (supervisorError.fatal) {
      this.#fail(supervisorError);
      return;
    }

    this.#reportSupervisorError(supervisorError.message, supervisorError);
  }

  #createSupervisorError(data: ShallowKnown<SupervisorError>) {
    const message = ensureString(data.message) || "The process supervisor signaled an error.";
    const isFatal = ensureBoolean(data.fatal) ?? false;
    const operation = ensureString(data.operation);
    const win32Error = ensureInt(data.win32Error);

    return new SupervisorOperationError(message, isFatal, operation, win32Error);
  }

  #disposeControl() {
    this.#control?.destroy();
    if (this.#server?.listening) {
      this.#server.close();
    }
  }

  #reportSupervisorError(logMessage: string, errorMessage?: string | Error) {
    const reason = errorMessage ? `: ${errorMessage instanceof Error ? errorMessage.message : errorMessage}` : "";
    const message = `${logMessage}${reason}`;
    void logError(
      message,
      errorMessage
        ? errorMessage instanceof Error
          ? errorMessage
          : new Error(String(errorMessage))
        : new Error(logMessage),
    ).catch(() => {});
  }

  #fail(error: unknown) {
    if (this.#failed) {
      return;
    }
    this.#failed = true;
    this.#failure = error;
    this.#rejectStartedPromise(error);
    this.#rejectJobCompletion(error);
    this.#disposeControl();

    process.off("SIGINT", this.#onSigint);

    for (const pendingRequest of this.#pendingRequests.values()) {
      pendingRequest.reject(error instanceof Error ? error : new Error(String(error)));
    }

    // Do not wait for the control protocol on failure. Killing the wrapper
    // closes its owning job handle, which also terminates any launched children.
    const wrapper = this.#wrapper;
    if (wrapper && wrapper.exitCode === null && wrapper.signalCode === null) {
      try {
        if (!wrapper.kill("SIGKILL")) {
          void logError("Unable to terminate the supervisor.", new Error("The kill request was not delivered.")).catch(
            () => {},
          );
        }
      } catch (killError) {
        void logError(
          "Unable to terminate the supervisor.",
          killError instanceof Error ? killError : new Error(String(killError)),
        ).catch(() => {});
      }
    }
  }

  async #waitForStartReport() {
    const controller = new AbortController();
    const { signal } = controller;

    try {
      return await Promise.race([
        this.#startedPromise,
        delay(START_TIMEOUT, undefined, { signal }).then(() => {
          throw new KnownError("Timed out waiting for the process to start.");
        }),
      ]);
    } finally {
      controller.abort();
    }
  }

  #getRequestControl(): Socket | undefined {
    if (this.#failed) {
      throw this.#failure;
    }
    if (this.#completed) {
      return undefined;
    }

    const control = this.#control;
    if (!control || control.destroyed || !control.writable || control.writableEnded || control.readableEnded) {
      const error = new Error("The supervisor control connection is unavailable.");
      this.#fail(error);
      throw error;
    }
    return control;
  }
}
