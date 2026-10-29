import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { Logger } from "@allurereport/cli-commons";
import { KnownError } from "@allurereport/service";

import { supervisorDiagnosticsEnabled } from "./diagnostics.js";
import type {
  InterruptionLevel,
  JobMonitor,
  ProcessCompletion,
  ProcessGroupCompletion,
  ProcessStartupInfo,
  RootCompletion,
  StopOptions,
  SupervisedCommandOptions,
} from "./model.js";

const DEFAULT_STOP_ESCALATION_TIMEOUT = 30_000;

export abstract class ProcessSupervisorBase {
  #logger?: Logger;
  #command: string;
  #arguments: readonly string[];
  #workingDirectory: string;
  #environmentVariables: Record<string, string>;
  #outputMode: "ignore" | "inherit" | "pipe";
  #silent: boolean;
  #outputEncoding: BufferEncoding;

  #process?: ChildProcess = undefined;
  #stdout: string = "";
  #stderr: string = "";

  #completionPromise: Promise<ProcessGroupCompletion> | undefined;
  #stopPromise: Promise<void> | undefined;
  #terminationPromise: Promise<void> | undefined;

  #gracefulStopAbortController?: AbortController;
  readonly #rootCloseAbortController = new AbortController();

  #started: boolean = false;
  #completed: boolean = false;

  #sigintSeen: boolean = false;
  #interrupted: InterruptionLevel | undefined;

  protected readonly diagnosticsEnabled: boolean;

  constructor(
    command: string,
    {
      logger,
      arguments: args = [],
      workingDirectory = process.cwd(),
      environmentVariables = {},
      outputMode = "pipe",
      outputEncoding = "utf-8",
      silent = false,
    }: SupervisedCommandOptions = {},
  ) {
    this.#logger = logger;
    this.#command = command;
    this.#arguments = args;
    this.#workingDirectory = workingDirectory;
    this.#environmentVariables = environmentVariables;
    this.#outputMode = outputMode;
    this.#outputEncoding = outputEncoding;
    this.#silent = silent;
    this.diagnosticsEnabled = Boolean(logger?.debugEnabled) && supervisorDiagnosticsEnabled();
  }

  get process(): ChildProcess {
    if (this.#process === undefined) {
      throw new Error("The process has not been started.");
    }

    return this.#process;
  }

  get started(): boolean {
    return this.#started;
  }

  get startupInfo(): ProcessStartupInfo {
    if (!this.started) {
      throw new Error("The process has not been started.");
    }

    const info = this.getStartupInfo();
    if (info === undefined) {
      throw new Error("The process startup information is unavailable.");
    }

    return info;
  }

  get completed(): boolean {
    return this.#completed;
  }

  get interrupted(): InterruptionLevel | undefined {
    return this.#interrupted;
  }

  get stdout(): Promise<string> {
    return this.completion.catch(() => {}).then(() => this.#stdout);
  }

  get stderr(): Promise<string> {
    return this.completion.catch(() => {}).then(() => this.#stderr);
  }

  get completion() {
    const promise = this.#completionPromise;

    if (promise === undefined) {
      throw new Error("The process has not been started.");
    }

    return promise;
  }

  get exitCode(): Promise<number | null> {
    return this.completion.then(({ code }) => code);
  }

  get signal(): Promise<NodeJS.Signals | null> {
    return this.completion.then(({ signal }) => signal);
  }

  async start() {
    if (this.#process !== undefined) {
      throw new Error("The process has already been started.");
    }

    const target = spawn(this.#command, this.#arguments, {
      cwd: this.#workingDirectory,
      env: this.resolveTargetEnvironment(),
      stdio: ["inherit", this.#outputMode, this.#outputMode],
      shell: this.shell,
      detached: this.detached,
    });

    if (this.#outputMode === "pipe") {
      target.stdout?.setEncoding(this.#outputEncoding).on("data", (data: string) => {
        this.#stdout += data;

        if (this.#silent) {
          return;
        }

        process.stdout.write(data);
      });

      target.stderr?.setEncoding(this.#outputEncoding).on("data", (data: string) => {
        this.#stderr += data;

        if (this.#silent) {
          return;
        }

        process.stderr.write(data);
      });
    }

    this.#process = target;
    this.#started = true;

    const stopDiagnostics = this.diagnoseRootProcess(target);

    this.#completionPromise = this.observeRootProcess(target).then(async ({ error, spawned, code, signal }) => {
      const errors: unknown[] = [];

      if (error) {
        errors.push(error);
      }

      const monitor = this.monitor;

      try {
        if (spawned) {
          this.diagnostic("waiting for process group completion");
          const jobCompletion = await monitor.wait({ code, signal });
          this.diagnostic("process group completed");
          if (jobCompletion) {
            code = jobCompletion.code;
            signal = jobCompletion.signal;
          }
        }
      } catch (e) {
        errors.push(e);
      }

      try {
        await monitor.dispose?.();
      } catch (e) {
        errors.push(e);
      }

      if (this.#rootCloseAbortController.signal.aborted) {
        // The group/job has finished while 'close' might've not been received.
        // Inherited pipes must not keep Allure alive.
        target.stdout?.destroy();
        target.stderr?.destroy();
      }

      if (errors.length === 1) {
        throw errors[0];
      }

      if (errors.length > 1) {
        throw new AggregateError(errors, "Multiple errors occurred while waiting for the process completion.");
      }

      this.#completed = true;

      return { code, signal, externalInterruption: this.#interrupted };
    });

    void this.#completionPromise.then(stopDiagnostics, stopDiagnostics);
  }

  stop({ escalate, escalationTimeout = DEFAULT_STOP_ESCALATION_TIMEOUT }: StopOptions = {}) {
    if (!Number.isFinite(escalationTimeout) || escalationTimeout <= 0 || escalationTimeout > 2_147_483_647) {
      throw new KnownError(`Invalid escalation timeout ${escalationTimeout}.`);
    }

    if (this.#process === undefined) {
      throw new Error("The process has not been started.");
    }

    if (this.completed) {
      return (this.#stopPromise ??= Promise.resolve());
    }

    return (this.#stopPromise ??= this.stopOnce(Boolean(escalate), escalationTimeout));
  }

  terminate() {
    if (this.#process === undefined) {
      throw new Error("The process has not been started.");
    }

    if (this.completed) {
      return (this.#terminationPromise ??= Promise.resolve());
    }

    return (this.#terminationPromise ??= this.terminateOnce());
  }

  protected abstract readonly shell: boolean;
  protected abstract readonly detached: boolean;
  protected abstract readonly monitor: JobMonitor;

  protected abstract requestGracefulStop(signal: AbortSignal): void | Promise<void>;
  protected abstract requestForcedTermination(): void | Promise<void>;
  protected abstract getStartupInfo(): ProcessStartupInfo | undefined;

  protected listenForSigint() {
    process.on("SIGINT", this.#onSigint);
  }

  protected stopListeningForSigint() {
    process.off("SIGINT", this.#onSigint);
  }

  readonly #onSigint = () => {
    if (this.interceptSigint()) {
      return;
    }

    if (!this.#sigintSeen) {
      this.#sigintSeen = true;
      this.stop({ escalate: false }).catch((error) => this.handleGracefulStopError(error));
      this.#interrupted = "stopped";
      return;
    }

    // The third SIGINT will use Node.js's default handler and terminate Allure.
    this.stopListeningForSigint();

    void this.terminate().catch((error) => this.handleForcedTerminationError(error));
    this.#interrupted = "terminated";
  };

  protected interceptSigint(): boolean {
    return false;
  }

  protected handleGracefulStopError(error: unknown) {
    this.error("Unable to gracefully stop the process. Press CTRL+C again to force termination.", error);
  }

  protected handleForcedTerminationError(error: unknown) {
    this.error("Unable to terminate the supervised process.", error);
  }

  protected error(message: string, error?: unknown) {
    if (error) {
      const resolvedError = error instanceof Error ? error : new Error(String(error));
      this.#logger?.error(`${new Date().toISOString()} ${message}: ${resolvedError.message}\n${resolvedError.stack}`);
    } else {
      this.#logger?.error(`${new Date().toISOString()} ${message}`);
    }
  }

  protected diagnostic(message: string, details?: Record<string, unknown>) {
    if (!this.diagnosticsEnabled || !this.#logger) {
      return;
    }
    try {
      const suffix = details === undefined ? "" : `: ${JSON.stringify(details)}`;
      this.#logger.debug(`${new Date().toISOString()} node pid=${process.pid} ${message}${suffix}`);
    } catch {}
  }

  protected async diagnoseRemainingProcesses(): Promise<void> {}

  private resolveTargetEnvironment() {
    const configuredEnvironment = {
      ...process.env,
      ...this.#environmentVariables,
    };

    const colorDefaults =
      this.#outputMode === "pipe" && configuredEnvironment.NO_COLOR === undefined
        ? {
            FORCE_COLOR: "1",
            CLICOLOR_FORCE: "1",
            COLOR: "1",
            COLORTERM: "truecolor",
            TERM: "xterm-256color",
          }
        : {};

    return {
      ...process.env,
      ...colorDefaults,
      ...this.#environmentVariables,
      // Suppress supervisor diagnostics in nested Allure invocations.
      // The outer invocation will report the entire process group anyway.
      ALLURE_SUPERVISOR_DIAGNOSTICS: "0",
    };
  }

  private diagnoseRootProcess(target: ChildProcess): () => void {
    let diagnosticTimer: ReturnType<typeof setInterval> | undefined;
    let inspecting = false;
    const inspect = async () => {
      if (inspecting) {
        return;
      }
      inspecting = true;
      try {
        await this.diagnoseRemainingProcesses();
      } catch (error) {
        this.diagnostic("process inspection failed", { error: String(error) });
      } finally {
        inspecting = false;
      }
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      this.diagnostic("supervised process exited", { pid: target.pid, code, signal });
      if (this.diagnosticsEnabled) {
        // Descendants can keep stdio open, delaying close and, unless
        // termination was requested, monitor.wait().
        void inspect();
        diagnosticTimer = setInterval(() => void inspect(), 30_000);
        diagnosticTimer.unref();
      }
    };

    const onSpawn = () => {
      this.diagnostic("supervised process started", { pid: target.pid });
    };
    const onError = (error: Error) => {
      this.diagnostic("supervised process error", { pid: target.pid, error: error.message });
    };
    const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
      this.diagnostic("supervised process stdio closed", { pid: target.pid, code, signal });
    };

    target.once("spawn", onSpawn);
    target.on("error", onError);
    target.once("exit", onExit);
    target.once("close", onClose);

    return () => {
      clearInterval(diagnosticTimer);
      target.off("spawn", onSpawn);
      target.off("error", onError);
      target.off("exit", onExit);
      target.off("close", onClose);
    };
  }

  private observeRootProcess(target: ChildProcess): Promise<RootCompletion> {
    return new Promise((resolve) => {
      let spawned = target.pid !== undefined;
      let processError: Error | undefined;
      let rootExit: ProcessCompletion | undefined;
      const closeWaitSignal = this.#rootCloseAbortController.signal;

      const onSpawn = () => {
        spawned = true;
      };

      const onError = (error: Error) => {
        processError ??= error;
      };

      const finish = (code: number | null, signal: NodeJS.Signals | null) => {
        target.off("spawn", onSpawn);
        target.off("error", onError);
        target.off("exit", onExit);
        target.off("close", finish);
        closeWaitSignal.removeEventListener("abort", onAbort);

        resolve({
          code,
          signal,
          spawned,
          error: processError,
        });
      };

      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        rootExit = { code, signal };
        if (closeWaitSignal.aborted) {
          // Termination requested before 'exit' was received.
          // Do not wait for stdio to close as that may delay or even hang the termination.
          finish(code, signal);
        }
      };

      const onAbort = () => {
        if (rootExit) {
          // Termination was requested between 'exit' and 'close'.
          // Do not wait for stdio to close as that may delay or even hang the termination.
          finish(rootExit.code, rootExit.signal);
        }
      };

      target.once("spawn", onSpawn);
      target.on("error", onError);
      target.once("exit", onExit);
      target.once("close", finish);
      closeWaitSignal.addEventListener("abort", onAbort, { once: true });
    });
  }

  private async stopOnce(escalate: boolean, escalationTimeout: number) {
    this.diagnostic("requesting graceful stop", { escalate, escalationTimeout });
    const controller = new AbortController();
    this.#gracefulStopAbortController = controller;

    const { signal } = controller;

    try {
      if (escalate) {
        await this.stopOnceOrEscalate(signal, escalationTimeout);
      } else {
        await this.stopOnceDontEscalate(signal);
      }
    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }

      this.diagnostic("graceful stop aborted", { reason: signal.reason });

      // terminate() was called.
      // Join the memoized termination promise to ensure the process is fully
      // terminated before returning.
      await this.terminate();
    } finally {
      // Abort the controller to clean up any pending operations, like timeouts.
      // Otherwise, such operations may keep Node.js from exiting.
      controller.abort();
      this.#gracefulStopAbortController = undefined;
    }
  }

  private async stopOnceDontEscalate(signal: AbortSignal) {
    await this.requestGracefulStop(signal);
    await this.completion;
  }

  private async stopOnceOrEscalate(signal: AbortSignal, escalationTimeout: number) {
    this.diagnostic("requesting graceful stop", { escalationTimeout });

    const requestStopAndWait = async () => {
      try {
        await this.requestGracefulStop(signal);
      } catch (stopError) {
        signal.throwIfAborted();

        const normalizedStopError = stopError instanceof Error ? stopError : new Error(String(stopError));
        this.error(
          `Failed to request graceful stop: ${normalizedStopError.message} The process will be terminated by force`,
          normalizedStopError,
        );

        try {
          await this.terminate();
        } catch (terminationError) {
          throw new AggregateError([stopError, terminationError], "Both graceful stop and forced termination failed.");
        }

        return "completed" as const;
      }

      await this.completion;
      return "completed" as const;
    };

    // Request graceful stop.
    // If no completion is reported within the timeout, terminate the process
    // (SIGTERM with a short SIGKILL fallback in POSIX, TerminateProcess in Windows).
    const result = await Promise.race([requestStopAndWait(), delay(escalationTimeout, "timeout" as const, { signal })]);

    if (result === "timeout") {
      this.diagnostic("graceful stop timed out");
      await this.terminate();
    }
  }

  private async terminateOnce() {
    // This abort controller only bypasses the root's stdio drain.
    // The platform-specific monitor still runs in full.
    this.#rootCloseAbortController.abort();

    if (this.#gracefulStopAbortController && !this.#gracefulStopAbortController.signal.aborted) {
      this.diagnostic("aborting graceful shutdown");
      this.#gracefulStopAbortController.abort("Termination requested.");
    }

    this.diagnostic("requesting forced termination");
    await this.requestForcedTermination();
    await this.completion;
  }
}
