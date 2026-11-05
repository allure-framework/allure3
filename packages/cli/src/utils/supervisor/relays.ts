import { type Readable, Transform, Writable, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";
import { StringDecoder } from "node:string_decoder";

export type OutputStreamRelayOptions = {
  encoding?: BufferEncoding;
  forward?: boolean;
  signal?: AbortSignal;
};

export type RelayResult =
  | { status: "completed"; captured: string }
  | { status: "cancelled"; captured: string }
  | { status: "failed"; captured: string; error: unknown };

export type RelayPipeline = {
  relay?: OutputStreamRelay;
  resultPromise: Promise<RelayResult>;
};

export class OutputStreamRelay extends Transform {
  readonly #decoder: StringDecoder;
  readonly #forwardRaw: boolean;

  #captured: string = "";

  constructor(encoding?: BufferEncoding) {
    super();

    this.#decoder = new StringDecoder(encoding ?? "utf-8");
    this.#forwardRaw = encoding === undefined;
  }

  get captured(): string {
    return this.#captured;
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback): void {
    const decoded = this.#decoder.write(chunk);
    this.#captured += decoded;
    done(null, this.#forwardRaw ? chunk : decoded);
  }

  override _flush(done: TransformCallback): void {
    const tail = this.#decoder.end();
    this.#captured += tail;
    done(null, this.#forwardRaw ? undefined : tail);
  }
}

export const createDiscardSink = () =>
  new Writable({
    write(_chunk: any, _encoding: BufferEncoding, done: (error?: Error | null) => void): void {
      done();
    },
  });

export const relayOutputStream = (
  upstream: Readable | null,
  downstream: Writable,
  { encoding, forward, signal }: OutputStreamRelayOptions = {},
): RelayPipeline => {
  if (upstream) {
    const relay = new OutputStreamRelay(encoding);
    const destination = forward ? downstream : createDiscardSink();

    return {
      relay,
      resultPromise: new Promise<RelayResult>(async (resolve) => {
        try {
          await pipeline(upstream, relay, destination, { end: !forward, signal });
          resolve({ status: "completed", captured: relay.captured });
        } catch (error) {
          if (isCancelled(signal, error)) {
            resolve({ status: "cancelled", captured: relay.captured });
          } else {
            resolve({ status: "failed", captured: relay.captured, error });
          }
        }
      }),
    };
  }

  return { resultPromise: Promise.resolve({ status: "completed", captured: "" }) };
};

const isCancelled = (signal: AbortSignal | undefined, error: unknown): boolean =>
  !!signal?.aborted &&
  error instanceof Error &&
  "code" in error &&
  error.code === "ABORT_ERR" &&
  error.cause === signal.reason;
