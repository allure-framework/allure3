import { spawn } from "node:child_process";
import type { Unknown } from "./validation.js";

const LINE_SPLIT_PATTERN = /\r\n|\r|\n/;

export type ProcessRunOptions = {
  /**
   * An expected exit code or an exit code validation function.
   */
  exitCode?: number | ((code: number) => boolean);

  /**
   * An stdout encoding. If specified, tool runner functions will emit stdout as strings.
   */
  encoding?: BufferEncoding;

  /**
   * An stderr encoding. If specified, tool runner functions will emit stderr as strings.
   */
  stderrEncoding?: BufferEncoding;

  /**
   * If set to a number greater than zero, sends the timeout signal to the tool process after the specified amount
   * of milliseconds.
   */
  timeout?: number;

  /**
   * A signal to send when the timeout is reached. `"SIGTERM"` by default.
   */
  timeoutSignal?: NodeJS.Signals;

  /**
   * If set to `true`, no stderr is captured. Otherwise, stderr will be reported as a part of `Error`
   * in case the tool fails.
   */
  ignoreStderr?: boolean;
};

/**
 * Runs a CLI tool ignoring its stdout. Useful for tools that produces the output as files or communicate
 * it by other means than via stdout.
 * @param executable A path to the tool. If it's the name of the executable, it must be available in `PATH`.
 * @param args An array of CLI arguments to pass to the tool.
 * @param param2 Tool invocation options.
 * @example
 * ```ts
 * const ensureNodeInstalled = () => {
 *   try {
 *     await invokeCliTool("node", ["--help"], { ignoreStderr: true });
 *   } catch (e) {
 *     console.log("Node.js is not installed!");
 *   }
 *   console.log("Node.js is installed");
 * };
 * ```
 */
export const invokeCliTool = async (
  executable: string,
  args: readonly string[],
  { timeout, timeoutSignal, ignoreStderr, encoding, exitCode: expectedExitCode = 0 }: ProcessRunOptions = {},
) => {
  const toolProcess = spawn(executable, args, {
    stdio: ["ignore", "ignore", ignoreStderr ? "ignore" : "pipe"],
    shell: false,
    timeout,
    killSignal: timeoutSignal,
  });

  const stderr: string[] = [];

  if (!ignoreStderr) {
    toolProcess.stderr?.setEncoding(encoding ?? "utf-8").on("data", (chunk) => stderr.push(String(chunk)));
  }

  let onSuccess: () => void;
  let onError: (e: Error) => void;

  const resultPromise = new Promise<void>((resolve, reject) => {
    onSuccess = resolve;
    onError = reject;
  });

  toolProcess.on("exit", (code, signal) => {
    if (signal) {
      onError(
        new Error(
          timeout && toolProcess.killed
            ? `${executable} was terminated by timeout (${timeout} ms)`
            : `${executable} was terminated with ${signal}`,
        ),
      );
      return;
    }

    if (typeof expectedExitCode === "number" ? code !== expectedExitCode : expectedExitCode(code!)) {
      onError(new Error(`${executable} finished with an unexpected exit code ${code}`));
      return;
    }

    onSuccess();
  });

  return await resultPromise;
};

type ResolveCliOutput<T> = T extends { encoding: BufferEncoding } ? string : Buffer;

/**
 * Invokes a CLI tool that communicates its result via stdout.
 * @param executable A path to the tool. If it's the name of the executable, it must be available in `PATH`.
 * @param args An array of CLI arguments to pass to the tool.
 * @param options Tool invocation options.
 * @returns An async generator. If `encoding` is set, the generator produces stdout lines as strings. Otherwise,
 * it produces instances of `Buffer` as they are emitted by Node.js.
 * @example
 * ```ts
 * const getNodeVersion = async () => {
 *   for await (const line of invokeStdoutCliTool("node", ["--version"], { encoding: "utf-8" })) {
 *     console.log(`Node.js version is ${line}`);
 *   }
 * };
 * ```
 */
export const invokeStdoutCliTool = async function* <T extends ProcessRunOptions | undefined>(
  executable: string,
  args: readonly string[],
  options?: T,
): AsyncGenerator<ResolveCliOutput<T>, void, unknown> {
  const {
    timeout,
    timeoutSignal,
    encoding,
    stderrEncoding,
    exitCode: expectedExitCode = 0,
    ignoreStderr,
  } = options ?? {};
  const emitTextChunk = (chunk: string) => {
    const lines = (unfinishedLineBuffer + chunk).split(LINE_SPLIT_PATTERN);
    if (lines.length) {
      unfinishedLineBuffer = lines.at(-1)!;
      stdoutChunks.push(...(lines.slice(0, -1) as ResolveCliOutput<T>[]));
      maybeContinueConsumption();
    }
  };

  const emitFinalTextChunk = () => {
    if (unfinishedLineBuffer) {
      stdoutChunks.push(unfinishedLineBuffer as ResolveCliOutput<T>);
      unfinishedLineBuffer = "";
      maybeContinueConsumption();
    }
  };

  const emitBinaryChunk = (chunk: Buffer) => {
    stdoutChunks.push(chunk as ResolveCliOutput<T>);
    maybeContinueConsumption();
  };

  const emitError = (message: string) => {
    if (stderrChunks.length) {
      message = `${message}\n\nStandard error:\n\n${stderrChunks.join("")}`;
    }
    bufferedError = new Error(message);
    maybeContinueConsumption();
  };

  const checkExitCode = (code: number) => {
    if (typeof expectedExitCode === "number") {
      return code === expectedExitCode;
    }

    return expectedExitCode(code);
  };

  const maybeContinueConsumption = () => {
    if (continueConsumption) {
      const continueConsumptionLocal = continueConsumption;
      continueConsumption = undefined;
      continueConsumptionLocal();
    }
  };

  const stdoutChunks: ResolveCliOutput<T>[] = [];
  let unfinishedLineBuffer = "";
  let done = false;
  let bufferedError: Error | undefined;

  const stderrChunks: string[] = [];

  let continueConsumption: (() => void) | undefined;

  const toolProcess = spawn(executable, args, {
    stdio: ["ignore", "pipe", ignoreStderr ? "ignore" : "pipe"],
    shell: false,
    timeout,
    killSignal: timeoutSignal,
  });

  const { stdout, stderr } = toolProcess;
  if (stdout) {
    if (encoding) {
      stdout.setEncoding(encoding).on("data", emitTextChunk);
    } else {
      stdout.on("data", emitBinaryChunk);
    }
  }

  if (stderr) {
    stderr.setEncoding(stderrEncoding ?? encoding ?? "utf-8").on("data", stderrChunks.push.bind(stderrChunks));
  }

  toolProcess.on("exit", (code, signal) => {
    emitFinalTextChunk();

    done = true;

    if (bufferedError) {
      return;
    }

    if (signal) {
      emitError(
        timeout && toolProcess.killed
          ? `${executable} was terminated by timeout (${timeout} ms)`
          : `${executable} was terminated with ${signal}`,
      );
      return;
    }

    if (!checkExitCode(code!)) {
      emitError(`${executable} finished with an unexpected exit code ${code}`);
      return;
    }

    continueConsumption?.();
  });

  while (true) {
    if (stdoutChunks.length) {
      yield* stdoutChunks;
      stdoutChunks.splice(0);
    }

    if (bufferedError) {
      throw bufferedError;
    }

    if (done) {
      return;
    }

    await new Promise<void>((resolve) => {
      continueConsumption = resolve;
    });
  }
};

/**
 * Invokes a CLI tool and collects its output in a single string using an encoding of choice.
 * @param executable A path to the tool. If it's the name of the executable, it must be available in `PATH`.
 * @param args An array of CLI arguments to pass to the tool.
 * @param options Tool invocation options. If `encoding` is not specified, `UTF-8` is used by default.
 * @returns A string containing the exact stdout of the tool.
 * @example
 * ```ts
 * const getNodeVersion = async () => {
 *   return await collectCliToolStdoutText("node", ["--version"]);
 * };
 * ```
 */
export const collectCliToolStdoutText = async (
  executable: string,
  args: readonly string[],
  options: ProcessRunOptions = {},
) => {
  const { encoding = "utf-8", ...rest } = options;
  const chunks: Buffer[] = [];
  for await (const chunk of invokeStdoutCliTool(executable, args, rest)) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString(encoding);
};

/**
 * Invokes a CLI tool and parses its stdout as a single JSON element.
 * @param executable A path to the tool. If it's the name of the executable, it must be available in `PATH`.
 * @param args An array of CLI arguments to pass to the tool.
 * @param options Tool invocation options. If `encoding` is not specified, `UTF-8` is used by default.
 * @returns A value parsed from the JSON stdout of the tool.
 * @example
 * const sayHello = async () => {
 *   const { message } = await invokeJsonCliTool(
 *     "node",
 *     ["-e", "console.log('{ \"message\": \"Hello from Node.js!\" }')"],
 *   );
 *   console.log(message);
 * };
 */
export const invokeJsonCliTool = async <T>(
  tool: string,
  args: readonly string[],
  options: ProcessRunOptions = {},
): Promise<Unknown<T>> => {
  const text = await collectCliToolStdoutText(tool, args, options);
  return JSON.parse(text);
};
