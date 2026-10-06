import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { KnownError } from "@allurereport/service";

import { logError } from "../logs.js";
import type { JobMonitor, RootCompletion, ProcessCompletion, SupervisedCommandOptions } from "./model.js";

const DEFAULT_STOP_TIMEOUT = 30_000;

export abstract class ProcessSupervisorBase {
  #command: string;
  #arguments: readonly string[];
  #workingDirectory: string;
  #environmentVariables: Record<string, string>;
  #stdio: "ignore" | "inherit" | "pipe";
  #silent: boolean;
  #outputEncoding: BufferEncoding;
  #stopTimeout: number;

  #process?: ChildProcess = undefined;
  #stdout: string = "";
  #stderr: string = "";

  #completionPromise: Promise<ProcessCompletion> | undefined;
  #stopPromise: Promise<void> | undefined;
  #terminationPromise: Promise<void> | undefined;

  #started: boolean = false;
  #completed: boolean = false;

  constructor(
    command: string,
    {
      arguments: args = [],
      workingDirectory = process.cwd(),
      environmentVariables = {},
      stdio = "pipe",
      outputEncoding = "utf-8",
      silent = false,
      stopTimeout = DEFAULT_STOP_TIMEOUT,
    }: SupervisedCommandOptions,
  ) {
    if (!Number.isFinite(stopTimeout) || stopTimeout <= 0 || stopTimeout > 2_147_483_647) {
      throw new KnownError(`Invalid stop timeout ${stopTimeout}.`);
    }

    this.#command = command;
    this.#arguments = args;
    this.#workingDirectory = workingDirectory;
    this.#environmentVariables = environmentVariables;
    this.#stdio = stdio;
    this.#outputEncoding = outputEncoding;
    this.#silent = silent;
    this.#stopTimeout = stopTimeout;
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

  get completed(): boolean {
    return this.#completed;
  }

  get stdout(): Promise<string> {
    return this.completion.then(() => this.#stdout);
  }

  get stderr(): Promise<string> {
    return this.completion.then(() => this.#stderr);
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
      stdio: this.#stdio,
      shell: this.shell,
      detached: this.detached,
    });

    if (this.#stdio === "pipe") {
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

    this.#completionPromise = this.observeRootProcess(target).then(async ({ error, spawned, code, signal }) => {
      const errors: unknown[] = [];

      if (error) {
        errors.push(error);
      }

      const monitor = this.monitor;

      try {
        if (spawned) {
          const jobCompletion = await monitor.wait();
          if (jobCompletion) {
            code = jobCompletion.code;
            signal = jobCompletion.signal;
          }
        }
      } catch (e) {
        errors.push(e);
      }

      try {
        monitor.dispose?.();
      } catch (e) {
        errors.push(e);
      }

      if (errors.length === 1) {
        throw errors[0];
      }

      if (errors.length > 1) {
        throw new AggregateError(errors, "Multiple errors occurred while waiting for the process completion.");
      }

      this.#completed = true;

      return { code, signal };
    });
  }

  stop() {
    if (this.#process === undefined) {
      throw new Error("The process has not been started.");
    }

    return (this.#stopPromise ??= this.stopOnce());
  }

  terminate() {
    if (this.#process === undefined) {
      throw new Error("The process has not been started.");
    }

    return (this.#terminationPromise ??= this.terminateOnce());
  }

  protected abstract readonly shell: boolean;
  protected abstract readonly detached: boolean;
  protected abstract readonly monitor: JobMonitor;

  protected abstract requestRootStop(signal: AbortSignal): void | Promise<void>;
  protected abstract requestTermination(): void | Promise<void>;

  private resolveTargetEnvironment() {
    const configuredEnvironment = {
      ...process.env,
      ...this.#environmentVariables,
    };

    const colorDefaults =
      this.#stdio === "pipe" && configuredEnvironment.NO_COLOR === undefined
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
    };
  }

  private observeRootProcess(target: ChildProcess): Promise<RootCompletion> {
    return new Promise((resolve) => {
      let spawned = target.pid !== undefined;
      let processError: Error | undefined;

      const onSpawn = () => {
        spawned = true;
      };

      const onError = (error: Error) => {
        processError ??= error;
      };

      const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
        target.off("spawn", onSpawn);
        target.off("error", onError);

        resolve({
          code,
          signal,
          spawned,
          error: processError,
        });
      };

      target.once("spawn", onSpawn);
      target.on("error", onError);
      target.once("close", onClose);
    });
  }

  private async stopOnce() {
    const controller = new AbortController();
    const { signal } = controller;

    const requestStopAndWait = async () => {
      try {
        await this.requestRootStop(signal);
      } catch (stopError) {
        const normalizedStopError = stopError instanceof Error ? stopError : new Error(String(stopError));
        void logError(
          `Failed to request graceful stop: ${normalizedStopError.message} - terminating...`,
          normalizedStopError,
        ).catch(() => {});

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

    try {
      // Request graceful stop (SIGINT on POSIX, Restart Manager on Windows).
      // If no completion is reported within the timeout, terminate by force
      // (SIGKILL in POSIX, TerminateProcess).
      const result = await Promise.race([
        requestStopAndWait(),
        delay(this.#stopTimeout, "timeout" as const, {
          signal: controller.signal,
        }),
      ]);

      if (result === "timeout") {
        await this.terminate();
      }
    } finally {
      controller.abort();
    }
  }

  private async terminateOnce() {
    await this.requestTermination();
    await this.completion;
  }
}
