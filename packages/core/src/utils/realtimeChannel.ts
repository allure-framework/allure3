import { EventEmitter } from "node:events";

import { AllureStoreEvents, RealtimeEvents, RealtimeEventsDispatcher, RealtimeSubscriber } from "./event.js";

/**
 * Owns the event bus used by realtime report generation.
 *
 * Store and CLI code publish through `dispatcher`; plugins subscribe through
 * `subscriber`. Full-report updates use `onResultLikeChanged` as a cheap invalidation
 * signal and let `RealtimeUpdateScheduler` decide when the rebuild should run.
 */
export class RealtimeChannel {
  readonly #emitter = new EventEmitter<AllureStoreEvents>();

  readonly dispatcher = new RealtimeEventsDispatcher(this.#emitter);
  readonly subscriber = new RealtimeSubscriber(this.#emitter);

  /**
   * Runs the listener synchronously when results, fixtures, or attachments change.
   *
   * Keep this callback cheap. It is meant to mark the report as dirty, not to rebuild
   * the report inline.
   */
  onResultLikeChanged(listener: () => void) {
    this.#emitter.on(RealtimeEvents.TestResult, listener);
    this.#emitter.on(RealtimeEvents.TestFixtureResult, listener);
    this.#emitter.on(RealtimeEvents.AttachmentFile, listener);

    return () => {
      this.#emitter.off(RealtimeEvents.TestResult, listener);
      this.#emitter.off(RealtimeEvents.TestFixtureResult, listener);
      this.#emitter.off(RealtimeEvents.AttachmentFile, listener);
    };
  }

  close(): void {
    this.subscriber.offAll();
  }
}
