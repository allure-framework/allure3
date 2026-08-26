import { clearLine, clearScreenDown, cursorTo, moveCursor } from "node:readline";
import type { WriteStream } from "node:tty";

type PatchedStream = {
  originalWrite: WriteStream["write"];
  owners: Set<Terminal>;
};

// shared patch state keeps multiple Terminals on one stream from restoring each other's wrappers
const patchedStreams = new WeakMap<WriteStream, PatchedStream>();

// Taken from https://github.com/npkgz/cli-progress
// low-level terminal interactions
export class Terminal {
  readonly #stream: WriteStream;
  // unpatched write, used for our own output so it never re-triggers #interceptForeignWrites
  readonly #originalWrite: WriteStream["write"];
  // shim over #originalWrite passed to node's readline helpers, for the same reason
  readonly #rawStream: { write: WriteStream["write"] };
  #wrapLines: boolean;
  #dy: number;
  // true while the current line has content but no trailing newline yet
  #lineActive = false;

  constructor(outputStream: WriteStream) {
    this.#stream = outputStream;
    this.#originalWrite = patchedStreams.get(outputStream)?.originalWrite ?? outputStream.write.bind(outputStream);
    this.#rawStream = { write: this.#originalWrite };

    // default: line wrapping enabled
    this.#wrapLines = true;

    // current, relative y position
    this.#dy = 0;

    if (outputStream.isTTY) {
      this.#interceptForeignWrites();
    }
  }

  // patches stream.write so foreign output (other loggers) never glues onto our in-place line
  #interceptForeignWrites() {
    const existing = patchedStreams.get(this.#stream);

    if (existing) {
      existing.owners.add(this);
      return;
    }

    const originalWrite = this.#originalWrite;
    const owners = new Set([this]);

    patchedStreams.set(this.#stream, { originalWrite, owners });

    this.#stream.write = ((...args: Parameters<WriteStream["write"]>) => {
      if ([...owners].some((owner) => owner.#lineActive)) {
        originalWrite("\n");

        for (const owner of owners) {
          owner.#lineActive = false;
        }
      }

      return originalWrite(...args);
    }) as WriteStream["write"];
  }

  // undoes #interceptForeignWrites, e.g. once this instance won't render anything else
  detach() {
    const state = patchedStreams.get(this.#stream);

    if (!state) {
      return;
    }

    state.owners.delete(this);

    if (state.owners.size === 0) {
      patchedStreams.delete(this.#stream);

      this.#stream.write = state.originalWrite;
    }
  }

  // save cursor position + settings
  cursorSave() {
    if (!this.#stream.isTTY) {
      return;
    }

    // save position
    this.#originalWrite("\x1B7");
  }

  // restore last cursor position + settings
  cursorRestore() {
    if (!this.#stream.isTTY) {
      return;
    }

    // restore cursor
    this.#originalWrite("\x1B8");
  }

  // show/hide cursor
  cursor(enabled: boolean) {
    if (!this.#stream.isTTY) {
      return;
    }

    if (enabled) {
      this.#originalWrite("\x1B[?25h");
    } else {
      this.#originalWrite("\x1B[?25l");
    }
  }

  // change cursor positionn
  cursorTo(x: number, y?: number) {
    if (!this.#stream.isTTY) {
      return;
    }

    // move cursor absolute
    cursorTo(this.#rawStream as WriteStream, x, y);
  }

  // change relative cursor position
  cursorRelative(dx: number, dy: number) {
    if (!this.#stream.isTTY) {
      return;
    }

    // store current position
    this.#dy = this.#dy + dy;

    // move cursor relative
    moveCursor(this.#rawStream as WriteStream, dx, dy);
  }

  // relative reset
  cursorRelativeReset() {
    if (!this.#stream.isTTY) {
      return;
    }

    // move cursor to initial line
    moveCursor(this.#rawStream as WriteStream, 0, -this.#dy);

    // first char
    cursorTo(this.#rawStream as WriteStream, 0);

    // reset counter
    this.#dy = 0;
  }

  // clear to the right from cursor
  clearRight() {
    if (!this.#stream.isTTY) {
      return;
    }

    clearLine(this.#rawStream as WriteStream, 1);
  }

  // clear the full line
  clearLine() {
    if (!this.#stream.isTTY) {
      return;
    }

    clearLine(this.#rawStream as WriteStream, 0);
  }

  // clear everyting beyond the current line
  clearBottom() {
    if (!this.#stream.isTTY) {
      return;
    }

    clearScreenDown(this.#rawStream as WriteStream);
  }

  // add new line; increment counter
  newline() {
    this.#originalWrite("\n");
    this.#dy++;
    this.#lineActive = false;
  }

  // write content to output stream
  // @TODO use string-width to strip length
  write(s: string, rawWrite: boolean = false) {
    // line wrapping enabled ? trim output
    // this is just a fallback mechanism in case user enabled line-wrapping via options or set it to auto
    if (this.#wrapLines && !rawWrite) {
      this.#originalWrite(s.slice(0, this.getWidth()));

      // standard behaviour with disabled linewrapping
    } else {
      this.#originalWrite(s);
    }

    if (s.length > 0) {
      this.#lineActive = true;
    }
  }

  // control line wrapping
  lineWrapping(enabled: boolean) {
    if (!this.isTTY()) {
      return;
    }

    // store state
    this.#wrapLines = enabled;
    if (enabled) {
      this.#originalWrite("\x1B[?7h");
    } else {
      this.#originalWrite("\x1B[?7l");
    }
  }

  // tty environment ?
  isTTY() {
    return this.#stream.isTTY;
  }

  // get terminal width
  getWidth() {
    // set max width to 80 in tty-mode and 200 in notty-mode
    return this.#stream.columns || (this.#stream.isTTY ? 80 : 200);
  }
}
