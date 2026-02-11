import type { TestError } from "@allurereport/core-api";
import type {
  BatchOptions,
  ExitCode,
  QualityGateValidationResult,
  RealtimeEventsDispatcher as RealtimeEventsDispatcherType,
  RealtimeSubscriber as RealtimeSubscriberType,
  ResultFile,
} from "@allurereport/plugin-api";
import console from "node:console";
import type { EventEmitter } from "node:events";
import { setTimeout } from "node:timers/promises";

export enum RealtimeEvents {
  TestResult = "testResult",
  TestFixtureResult = "testFixtureResult",
  AttachmentFile = "attachmentFile",
  QualityGateResults = "qualityGateResults",
  GlobalAttachment = "globalAttachment",
  GlobalError = "globalError",
  GlobalExitCode = "globalExitCode",
}

export interface AllureStoreEvents {
  [RealtimeEvents.QualityGateResults]: [QualityGateValidationResult[]];
  [RealtimeEvents.TestResult]: [string];
  [RealtimeEvents.TestFixtureResult]: [string];
  [RealtimeEvents.AttachmentFile]: [string];
  [RealtimeEvents.GlobalAttachment]: [{ attachment: ResultFile; fileName?: string }];
  [RealtimeEvents.GlobalExitCode]: [ExitCode];
  [RealtimeEvents.GlobalError]: [TestError];
}

interface HandlerData {
  buffer: string[];
  timeout?: Promise<void>;
  ac?: AbortController;
}

export class RealtimeEventsDispatcher implements RealtimeEventsDispatcherType {
  readonly #emitter: EventEmitter<AllureStoreEvents>;

  constructor(emitter: EventEmitter<AllureStoreEvents>) {
    this.#emitter = emitter;
  }

  sendGlobalAttachment(attachment: ResultFile, fileName?: string) {
    this.#emitter.emit(RealtimeEvents.GlobalAttachment, { attachment, fileName });
  }

  sendGlobalExitCode(codes: ExitCode) {
    this.#emitter.emit(RealtimeEvents.GlobalExitCode, codes);
  }

  sendGlobalError(error: TestError) {
    this.#emitter.emit(RealtimeEvents.GlobalError, error);
  }

  sendQualityGateResults(payload: QualityGateValidationResult[]) {
    this.#emitter.emit(RealtimeEvents.QualityGateResults, payload ?? []);
  }

  sendTestResult(trId: string) {
    this.#emitter.emit(RealtimeEvents.TestResult, trId);
  }

  sendTestFixtureResult(tfrId: string) {
    this.#emitter.emit(RealtimeEvents.TestFixtureResult, tfrId);
  }

  sendAttachmentFile(afId: string) {
    this.#emitter.emit(RealtimeEvents.AttachmentFile, afId);
  }
}

export class RealtimeSubscriber implements RealtimeSubscriberType {
  readonly #emitter: EventEmitter<AllureStoreEvents>;
  #handlers: HandlerData[] = [];

  constructor(emitter: EventEmitter<AllureStoreEvents>) {
    this.#emitter = emitter;
  }

  onGlobalAttachment(listener: (payload: { attachment: ResultFile; fileName?: string }) => Promise<void>) {
    this.#emitter.on(RealtimeEvents.GlobalAttachment, listener);

    return () => {
      this.#emitter.off(RealtimeEvents.GlobalAttachment, listener);
    };
  }

  onGlobalExitCode(listener: (payload: ExitCode) => Promise<void>) {
    this.#emitter.on(RealtimeEvents.GlobalExitCode, listener);

    return () => {
      this.#emitter.off(RealtimeEvents.GlobalExitCode, listener);
    };
  }

  onGlobalError(listener: (error: TestError) => Promise<void>) {
    this.#emitter.on(RealtimeEvents.GlobalError, listener);

    return () => {
      this.#emitter.off(RealtimeEvents.GlobalError, listener);
    };
  }

  onQualityGateResults(listener: (payload: QualityGateValidationResult[]) => Promise<void>) {
    this.#emitter.on(RealtimeEvents.QualityGateResults, listener);

    return () => {
      this.#emitter.off(RealtimeEvents.QualityGateResults, listener);
    };
  }

  onTestResults(listener: (trIds: string[]) => Promise<void>, options: BatchOptions = {}) {
    const { maxTimeout = 100 } = options;
    const handler = this.#createBatchHandler(maxTimeout, listener);

    this.#emitter.on(RealtimeEvents.TestResult, handler);

    return () => {
      this.#emitter.off(RealtimeEvents.TestResult, handler);
    };
  }

  onTestFixtureResults(listener: (tfrIds: string[]) => Promise<void>, options: BatchOptions = {}) {
    const { maxTimeout = 100 } = options;
    const handler = this.#createBatchHandler(maxTimeout, listener);

    this.#emitter.on(RealtimeEvents.TestFixtureResult, handler);

    return () => {
      this.#emitter.off(RealtimeEvents.TestFixtureResult, handler);
    };
  }

  onAttachmentFiles(listener: (afIds: string[]) => Promise<void>, options: BatchOptions = {}) {
    const { maxTimeout = 100 } = options;
    const handler = this.#createBatchHandler(maxTimeout, listener);

    this.#emitter.on(RealtimeEvents.AttachmentFile, handler);

    return () => {
      this.#emitter.off(RealtimeEvents.AttachmentFile, handler);
    };
  }

  onAll(listener: () => Promise<void>, options: BatchOptions = {}) {
    const { maxTimeout = 100 } = options;
    const handler = this.#createBatchHandler(maxTimeout, listener);

    this.#emitter.on(RealtimeEvents.TestResult, handler);
    this.#emitter.on(RealtimeEvents.TestFixtureResult, handler);
    this.#emitter.on(RealtimeEvents.AttachmentFile, handler);

    return () => {
      this.#emitter.off(RealtimeEvents.TestResult, handler);
      this.#emitter.off(RealtimeEvents.TestFixtureResult, handler);
      this.#emitter.off(RealtimeEvents.AttachmentFile, handler);
    };
  }

  offAll() {
    this.#emitter.removeAllListeners();

    for (const handler of this.#handlers) {
      handler.ac?.abort();
    }

    this.#handlers = [];
  }

  /**
   * Creates handler for event emitter that accumulates data and calls the given callback with the accumulated data once per given timeout
   * @example
   * ```ts
   * const emitter = new EventEmitter();
   * const dispatcher = new EventsDispatcher(emitter);
   * const subscriber = new EventsSubscriber(emitter);
   *
   * subscriber.onTestResults((trs) => {
   *   console.log(trs); // [1, 2, 3]
   * });
   *
   * dispatcher.sendTestResult(1);
   * dispatcher.sendTestResult(2);
   * dispatcher.sendTestResult(3);
   * ```
   * @param maxTimeout
   * @param listener
   * @private
   */
  #createBatchHandler(maxTimeout: number, listener: (args: string[]) => Promise<void>) {
    const handler: HandlerData = {
      buffer: [],
    };

    this.#handlers.push(handler);

    return (trId: string) => {
      handler.buffer.push(trId);

      // release timeout is already set
      if (handler.timeout) {
        return;
      }

      handler.ac = new AbortController();
      handler.timeout = setTimeout<void>(maxTimeout, undefined, { signal: handler.ac.signal })
        .then(() => {
          handler.timeout = undefined;

          const bufferCopy = [...handler.buffer];

          handler.buffer = [];
          handler.ac = undefined;

          return listener(bufferCopy);
        })
        .catch((err) => {
          if (err.name === "AbortError") {
            return;
          }

          console.error("can't execute listener", err);
        });
    };
  }
}
