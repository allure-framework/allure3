import { clearLine, clearScreenDown, cursorTo, moveCursor } from "node:readline";
import type { WriteStream } from "node:tty";

// tracks which streams already have a Terminal's write-interception installed, so constructing
// more than one Terminal for the same stream doesn't stack patches on top of each other.
const patchedStreams = new WeakSet<WriteStream>();

// Taken from https://github.com/npkgz/cli-progress
// low-level terminal interactions
export class Terminal {
  readonly #stream: WriteStream;
  // the stream's original, unpatched write, used for everything this class writes itself so it
  // never re-triggers its own foreign-write interception (see #interceptForeignWrites).
  readonly #originalWrite: WriteStream["write"];
  // a stream-like shim over #originalWrite, handed to node's readline helpers (cursorTo, etc.)
  // instead of the real stream, for the same reason.
  readonly #rawStream: { write: WriteStream["write"] };
  #wrapLines: boolean;
  #dy: number;
  // true while we've written visible content on the current line without terminating it with a
  // newline yet (i.e. a line we expect to redraw in place later).
  #lineActive = false;

  constructor(outputStream: WriteStream) {
    this.#stream = outputStream;
    this.#originalWrite = outputStream.write.bind(outputStream);
    this.#rawStream = { write: this.#originalWrite };

    // default: line wrapping enabled
    this.#wrapLines = true;

    // current, relative y position
    this.#dy = 0;

    if (outputStream.isTTY) {
      this.#interceptForeignWrites();
    }
  }

  // Other code (other plugins' loggers, console.log, …) can write to the same stream between our
  // renders. If we're mid-way through an in-place line (no trailing newline yet) when that
  // happens, their text ends up glued onto ours instead of starting on its own line. Patching
  // the stream's own `write` lets us notice and terminate our line first, so foreign output
  // always starts clean — without requiring every other writer to know about us.
  #interceptForeignWrites() {
    if (patchedStreams.has(this.#stream)) {
      return;
    }

    patchedStreams.add(this.#stream);

    const originalWrite = this.#originalWrite;

    this.#stream.write = ((...args: Parameters<WriteStream["write"]>) => {
      if (this.#lineActive) {
        originalWrite("\n");
        this.#lineActive = false;
      }

      return originalWrite(...args);
    }) as WriteStream["write"];
  }

  // undo the write patch installed by #interceptForeignWrites, e.g. once the report is done and
  // this instance won't render anything else.
  detach() {
    if (patchedStreams.has(this.#stream)) {
      patchedStreams.delete(this.#stream);
      this.#stream.write = this.#originalWrite;
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
