import console from "node:console";
import { EventEmitter } from "node:events";
import { setTimeout } from "node:timers/promises";

import type {
  BatchOptions,
  ExitCode,
  PluginGlobalError,
  QualityGateValidationResult,
  RealtimeEventsDispatcher as RealtimeEventsDispatcherType,
  RealtimeListenerResult,
  RealtimeSubscriber as RealtimeSubscriberType,
  ResultFile,
} from "@allurereport/plugin-api";

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
  [RealtimeEvents.GlobalAttachment]: [{ attachment: ResultFile; fileName?: string; environment?: string }];
  [RealtimeEvents.GlobalExitCode]: [ExitCode];
  [RealtimeEvents.GlobalError]: [PluginGlobalError];
}

type RealtimeListener<T extends unknown[]> = (...args: T) => RealtimeListenerResult;
type BatchedRealtimeListener = (args: string[]) => RealtimeListenerResult;

interface BatchHandler {
  buffer: string[];
  cycle?: Promise<void>;
  abortController?: AbortController;
  closed: boolean;
}

const runListener = <T extends unknown[]>(listener: RealtimeListener<T>, ...args: T): Promise<void> => {
  try {
    return Promise.resolve(listener(...args)).catch((err) => {
      console.error("can't execute listener", err);
    });
  } catch (err) {
    console.error("can't execute listener", err);

    return Promise.resolve();
  }
};

const createListenerHandler =
  <T extends unknown[]>(listener: RealtimeListener<T>) =>
  (...args: T) => {
    void runListener(listener, ...args);
  };

/**
 * Publishes store changes to realtime subscribers.
 */
export class RealtimeEventsDispatcher implements RealtimeEventsDispatcherType {
  readonly #emitter: EventEmitter<AllureStoreEvents>;

  constructor(emitter: EventEmitter<AllureStoreEvents>) {
    this.#emitter = emitter;
  }

  sendGlobalAttachment(attachment: ResultFile, fileName?: string, environment?: string) {
    this.#emitter.emit(RealtimeEvents.GlobalAttachment, { attachment, fileName, environment });
  }

  sendGlobalExitCode(codes: ExitCode) {
    this.#emitter.emit(RealtimeEvents.GlobalExitCode, codes);
  }

  sendGlobalError(error: PluginGlobalError) {
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

/**
 * Subscriptions used by plugins and core code that react to realtime store changes.
 *
 * Result-like events are batched by id. Global events are delivered immediately.
 */
export class RealtimeSubscriber implements RealtimeSubscriberType {
  readonly #emitter: EventEmitter<AllureStoreEvents>;
  #handlers: BatchHandler[] = [];

  constructor(emitter: EventEmitter<AllureStoreEvents>) {
    this.#emitter = emitter;
  }

  onGlobalAttachment(
    listener: (payload: { attachment: ResultFile; fileName?: string; environment?: string }) => RealtimeListenerResult,
  ) {
    return this.#onEvent(RealtimeEvents.GlobalAttachment, listener);
  }

  onGlobalExitCode(listener: (payload: ExitCode) => RealtimeListenerResult) {
    return this.#onEvent(RealtimeEvents.GlobalExitCode, listener);
  }

  onGlobalError(listener: (error: PluginGlobalError) => RealtimeListenerResult) {
    return this.#onEvent(RealtimeEvents.GlobalError, listener);
  }

  onQualityGateResults(listener: (payload: QualityGateValidationResult[]) => RealtimeListenerResult) {
    return this.#onEvent(RealtimeEvents.QualityGateResults, listener);
  }

  /**
   * Subscribe to test result ids.
   *
   * Ids are collected for up to `maxTimeout` ms. A subscriber is never called twice
   * at the same time; ids received while the listener is running are sent in the
   * next batch.
   */
  onTestResults(listener: (trIds: string[]) => RealtimeListenerResult, options: BatchOptions = {}) {
    return this.#onBatchedEvent(RealtimeEvents.TestResult, listener, options);
  }

  /**
   * Subscribe to test fixture result ids.
   *
   * @see {@link onTestResults} for batching semantics.
   */
  onTestFixtureResults(listener: (tfrIds: string[]) => RealtimeListenerResult, options: BatchOptions = {}) {
    return this.#onBatchedEvent(RealtimeEvents.TestFixtureResult, listener, options);
  }

  /**
   * Subscribe to attachment file ids.
   *
   * @see {@link onTestResults} for batching semantics.
   */
  onAttachmentFiles(listener: (afIds: string[]) => RealtimeListenerResult, options: BatchOptions = {}) {
    return this.#onBatchedEvent(RealtimeEvents.AttachmentFile, listener, options);
  }

  #onEvent(event: keyof AllureStoreEvents, listener: (...args: any[]) => RealtimeListenerResult) {
    const handler = createListenerHandler(listener);

    this.#emitter.on(event, handler);

    return () => {
      this.#emitter.off(event, handler);
    };
  }

  #onBatchedEvent(
    event: RealtimeEvents.TestResult | RealtimeEvents.TestFixtureResult | RealtimeEvents.AttachmentFile,
    listener: BatchedRealtimeListener,
    options: BatchOptions,
  ) {
    const { maxTimeout = 100 } = options;
    const { dispose, eventHandler } = this.#createBatchHandler(maxTimeout, listener);

    this.#emitter.on(event, eventHandler);

    return () => {
      this.#emitter.off(event, eventHandler);
      dispose();
    };
  }

  offAll() {
    this.#emitter.removeAllListeners();

    for (const handler of this.#handlers) {
      this.#disposeBatchHandler(handler);
    }

    this.#handlers = [];
  }

  /**
   * Creates one batching queue for one subscription.
   *
   * The listener may be sync or async. Either way, the next batch waits until the
   * current listener call settles, so slow subscribers do not overlap with themselves.
   */
  #createBatchHandler(maxTimeout: number, listener: BatchedRealtimeListener) {
    const handler: BatchHandler = {
      buffer: [],
      closed: false,
    };

    this.#handlers.push(handler);

    const eventHandler = (trId: string) => {
      if (handler.closed) {
        return;
      }

      handler.buffer.push(trId);

      // A delivery cycle is already scheduled or running.
      if (handler.cycle) {
        return;
      }

      handler.cycle = this.#runBatchHandler(handler, maxTimeout, listener);
    };

    return {
      dispose: () => this.#disposeBatchHandler(handler),
      eventHandler,
    };
  }

  async #runBatchHandler(handler: BatchHandler, maxTimeout: number, listener: BatchedRealtimeListener) {
    try {
      while (!handler.closed && handler.buffer.length > 0) {
        handler.abortController = new AbortController();
        await setTimeout<void>(maxTimeout, undefined, { signal: handler.abortController.signal });
        handler.abortController = undefined;

        const bufferCopy = [...handler.buffer];

        handler.buffer = [];

        await runListener(listener, bufferCopy);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return;
      }

      handler.buffer = [];
      console.error("can't execute listener", err);
    } finally {
      handler.abortController = undefined;
      handler.cycle = undefined;
    }
  }

  #disposeBatchHandler(handler: BatchHandler) {
    handler.closed = true;
    handler.abortController?.abort();
    handler.abortController = undefined;
    handler.buffer = [];
    handler.cycle = undefined;
    this.#handlers = this.#handlers.filter((registeredHandler) => registeredHandler !== handler);
  }
}
