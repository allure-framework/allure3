import type { TestError } from "@allurereport/core-api"
import type {
  BatchOptions,
  PrivateEventsDispatcher,
  PublicEventsDispatcher,
  RealtimeSubscriber,
} from "@allurereport/plugin-api";
import console from "node:console";
import type { EventEmitter } from "node:events";
import { setTimeout } from "node:timers/promises";

export enum RealtimeEvents {
  TestResult = "testResult",
  TestFixtureResult = "testFixtureResult",
  AttachmentFile = "attachmentFile",
  GlobalError = "globalError",
  TerminationRequest = "terminationRequest",
}

export interface AllureStoreEvents {
  [RealtimeEvents.GlobalError]: [TestError];
  [RealtimeEvents.TerminationRequest]: [number, string?];
  [RealtimeEvents.TestResult]: [string];
  [RealtimeEvents.TestFixtureResult]: [string];
  [RealtimeEvents.AttachmentFile]: [string];
}

interface HandlerData {
  buffer: string[];
  timeout?: Promise<void>;
  ac?: AbortController;
}

export class ExternalEventsDispatcher implements PublicEventsDispatcher {
  readonly #emitter: EventEmitter<AllureStoreEvents>;

  constructor(emitter: EventEmitter<AllureStoreEvents>) {
    this.#emitter = emitter;
  }

  sendGlobalError(error: TestError) {
    this.#emitter.emit(RealtimeEvents.GlobalError, error);
  }

  sendTerminationRequest(code: number, reason?: string) {
    this.#emitter.emit(RealtimeEvents.TerminationRequest, code, reason);
  }
}

export class InternalEventsDispatcher implements PrivateEventsDispatcher {
  readonly #emitter: EventEmitter<AllureStoreEvents>;

  constructor(emitter: EventEmitter<AllureStoreEvents>) {
    this.#emitter = emitter;
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

export class RealtimeEventsSubscriber implements RealtimeSubscriber {
  readonly #emitter: EventEmitter<AllureStoreEvents>;
  #handlers: HandlerData[] = [];

  constructor(emitter: EventEmitter<AllureStoreEvents>) {
    this.#emitter = emitter;
  }

  onGlobalError(listener: (error: TestError) => Promise<void>) {
    this.#emitter.on(RealtimeEvents.GlobalError, listener);
  }

  onTerminationRequest(listener: (code: number, reason?: string) => Promise<void>) {
    this.#emitter.on(RealtimeEvents.TerminationRequest, listener);
  }

  onTestResults = (listener: (trIds: string[]) => Promise<void>, options: BatchOptions = {}): void => {
    const { maxTimeout = 100 } = options;
    const handler = this.#createBatchHandler(maxTimeout, listener);

    this.#emitter.on(RealtimeEvents.TestResult, handler);
  };

  onTestFixtureResults = (listener: (tfrIds: string[]) => Promise<void>, options: BatchOptions = {}): void => {
    const { maxTimeout = 100 } = options;
    const handler = this.#createBatchHandler(maxTimeout, listener);

    this.#emitter.on(RealtimeEvents.TestFixtureResult, handler);
  };

  onAttachmentFiles(listener: (afIds: string[]) => Promise<void>, options: BatchOptions = {}): void {
    const { maxTimeout = 100 } = options;
    const handler = this.#createBatchHandler(maxTimeout, listener);

    this.#emitter.on(RealtimeEvents.AttachmentFile, handler);
  }

  onAll(listener: () => Promise<void>, options: BatchOptions = {}): void {
    const { maxTimeout = 100 } = options;
    const handler = this.#createBatchHandler(maxTimeout, listener);

    this.#emitter.on(RealtimeEvents.TestResult, handler);
    this.#emitter.on(RealtimeEvents.TestFixtureResult, handler);
    this.#emitter.on(RealtimeEvents.AttachmentFile, handler);
  }

  offAll(): void {
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
