import { describe, expect, it } from "vitest";
import {
  type ProcessRunOptions,
  invokeJsonCliTool,
  invokeStdoutCliTool,
  invokeTextStdoutCliTool,
} from "../src/toolRunner.js";

describe("invokeTextStdoutCliTool", () => {
  it("should stop with a timeout", async () => {
    await expect(
      invokeStdoutCliTool("node", ["-e", "setTimeout(() => {}, 1000);"], { timeout: 10 }).next(),
    ).rejects.toThrow("node was terminated by timeout (10 ms)");
  });

  it("should stop with a specific timeout signal", async () => {
    await expect(
      invokeStdoutCliTool(
        "node",
        ["-e", "process.on('SIGTERM', () => { return false; }); setTimeout(() => {}, 1000);"],
        {
          timeout: 50,
          timeoutSignal: "SIGINT",
        },
      ).next(),
    ).rejects.toThrow("node was terminated by timeout (50 ms)");
  });

  it("should throw on non-zero exit code", async () => {
    await expect(invokeStdoutCliTool("node", ["-e", "process.exit(1)"]).next()).rejects.toThrow(
      "node finished with an unexpected exit code 1",
    );
  });

  it("should accept a user-defined exit code", async () => {
    await expect(invokeStdoutCliTool("node", ["-e", "process.exit(1)"], { exitCode: 1 }).next()).resolves.toMatchObject(
      { done: true },
    );
  });

  it("should accept if a user-defined exit code predicate returns true", async () => {
    await expect(
      invokeStdoutCliTool("node", ["-e", "process.exit(1)"], { exitCode: (e) => e > 0 }).next(),
    ).resolves.toMatchObject({ done: true });
  });

  it("should throw if a user-defined exit code predicate returns false", async () => {
    await expect(invokeStdoutCliTool("node", ["-e", ""], { exitCode: (e) => e > 0 }).next()).rejects.toThrow(
      "node finished with an unexpected exit code 0",
    );
  });

  it("shows stderr if failed", async () => {
    await expect(invokeStdoutCliTool("node", ["-e", "console.error('foo'); process.exit(1);"]).next()).rejects.toThrow(
      "node finished with an unexpected exit code 1\n\nStandard error:\n\nfoo\n",
    );
  });

  it("ignores stderr if ignoreStderr is set", async () => {
    await expect(
      invokeStdoutCliTool("node", ["-e", "console.error('foo'); process.exit(1);"], { ignoreStderr: true }).next(),
    ).rejects.toThrow(/^node finished with an unexpected exit code 1$/);
  });

  it("should apply stderr encoding", async () => {
    await expect(
      invokeStdoutCliTool("node", ["-e", "process.stderr.write(Buffer.from([0xAC, 0x20])); process.exit(1);"], {
        stderrEncoding: "utf-16le",
      }).next(),
    ).rejects.toThrow("node finished with an unexpected exit code 1\n\nStandard error:\n\n€");
  });

  describe("binary mode", () => {
    const collectAsync = async (code: string, options: ProcessRunOptions = {}) => {
      const chunks: Buffer[] = [];
      for await (const chunk of invokeStdoutCliTool("node", ["-e", code], options)) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    };

    it("should iterate empty output", async () => {
      expect(await collectAsync("")).toEqual(Buffer.from([]));
    });

    it("should iterate over some output", async () => {
      expect(await collectAsync("process.stdout.write(Buffer.from([0xFE, 0xFF]))")).toEqual(Buffer.from([0xfe, 0xff]));
    });

    it("should iterate over multiple chunks output", async () => {
      expect(
        await collectAsync(`
          let i = -1;
          const write = () => {
            i++;
            if (i < 100) {
              process.stdout.write(Buffer.from([i]), write);
            }
          };
          write();
        `),
      ).toEqual(Buffer.from([...new Array(100).keys()]));
    });
  });

  describe("text mode", () => {
    const collectAsync = async (code: string, options: ProcessRunOptions = {}) => {
      const lines: string[] = [];
      for await (const line of invokeStdoutCliTool("node", ["-e", code], { encoding: "utf-8", ...options })) {
        lines.push(line);
      }
      return lines;
    };

    it("should iterate empty output", async () => {
      expect(await collectAsync("")).toEqual([]);
    });

    it("should iterate over a single line", async () => {
      expect(await collectAsync("console.log('Hello, world')")).toEqual(["Hello, world"]);
    });

    it("should iterate over a multiple lines", async () => {
      expect(
        await collectAsync(`
        console.log("Lorem Ipsum");
        console.log("Dolor Sit Amet,");
        console.log("Consectetur Adipiscing Elit");
      `),
      ).toEqual(["Lorem Ipsum", "Dolor Sit Amet,", "Consectetur Adipiscing Elit"]);
    });

    it("should emit unterminated line", async () => {
      expect(await collectAsync("process.stdout.write('Lorem Ipsum');")).toEqual(["Lorem Ipsum"]);
    });

    it("should use the specified encoding to decode stdout", async () => {
      expect(await collectAsync("process.stdout.write(Buffer.from([0xAC, 0x20]));", { encoding: "utf-16le" })).toEqual([
        "€",
      ]);
    });

    it("should use stdout encoding for stderr by default", async () => {
      await expect(
        invokeStdoutCliTool("node", ["-e", "process.stderr.write(Buffer.from([0xAC, 0x20])); process.exit(1);"], {
          encoding: "utf-16le",
        }).next(),
      ).rejects.toThrow("node finished with an unexpected exit code 1\n\nStandard error:\n\n€");
    });
  });
});

describe("invokeTextStdoutCliTool", () => {
  const collectAsync = async (code: string, options: ProcessRunOptions = {}) => {
    const lines: string[] = [];
    for await (const line of invokeTextStdoutCliTool("node", ["-e", code], options)) {
      lines.push(line);
    }
    return lines;
  };

  it("should iterate empty output", async () => {
    expect(await collectAsync("")).toEqual([]);
  });

  it("should iterate over a single line", async () => {
    expect(await collectAsync("console.log('Hello, world')")).toEqual(["Hello, world"]);
  });

  it("should iterate over a multiple lines", async () => {
    expect(
      await collectAsync(`
        console.log("Lorem Ipsum");
        console.log("Dolor Sit Amet,");
        console.log("Consectetur Adipiscing Elit");
      `),
    ).toEqual(["Lorem Ipsum", "Dolor Sit Amet,", "Consectetur Adipiscing Elit"]);
  });

  it("should emit unterminated line", async () => {
    expect(await collectAsync("process.stdout.write('Lorem Ipsum');")).toEqual(["Lorem Ipsum"]);
  });

  it("should stop with a timeout", async () => {
    await expect(
      invokeTextStdoutCliTool("node", ["-e", "setTimeout(() => {}, 1000);"], { timeout: 10 }).next(),
    ).rejects.toThrow("node was terminated by timeout (10 ms)");
  });

  it("should stop with a specific timeout signal", async () => {
    await expect(
      invokeTextStdoutCliTool(
        "node",
        ["-e", "process.on('SIGTERM', () => { return false; }); setTimeout(() => {}, 1000);"],
        {
          timeout: 50,
          timeoutSignal: "SIGINT",
        },
      ).next(),
    ).rejects.toThrow("node was terminated by timeout (50 ms)");
  });

  it("should throw on non-zero exit code", async () => {
    await expect(invokeTextStdoutCliTool("node", ["-e", "process.exit(1)"]).next()).rejects.toThrow(
      "node finished with an unexpected exit code 1",
    );
  });

  it("should accept a user-defined exit code", async () => {
    await expect(
      invokeTextStdoutCliTool("node", ["-e", "process.exit(1)"], { exitCode: 1 }).next(),
    ).resolves.toMatchObject({ done: true });
  });

  it("should accept if a user-defined exit code predicate returns true", async () => {
    await expect(
      invokeTextStdoutCliTool("node", ["-e", "process.exit(1)"], { exitCode: (e) => e > 0 }).next(),
    ).resolves.toMatchObject({ done: true });
  });

  it("should throw if a user-defined exit code predicate returns false", async () => {
    await expect(invokeTextStdoutCliTool("node", ["-e", ""], { exitCode: (e) => e > 0 }).next()).rejects.toThrow(
      "node finished with an unexpected exit code 0",
    );
  });

  it("shows stderr if failed", async () => {
    await expect(
      invokeTextStdoutCliTool("node", ["-e", "console.error('foo'); process.exit(1);"]).next(),
    ).rejects.toThrow("node finished with an unexpected exit code 1\n\nStandard error:\n\nfoo\n");
  });

  it("ignores stderr if ignoreStderr is set", async () => {
    await expect(
      invokeTextStdoutCliTool("node", ["-e", "console.error('foo'); process.exit(1);"], { ignoreStderr: true }).next(),
    ).rejects.toThrow(/^node finished with an unexpected exit code 1$/);
  });

  it("should use the specified encoding to decode stdout", async () => {
    expect(await collectAsync("process.stdout.write(Buffer.from([0xAC, 0x20]));", { encoding: "utf-16le" })).toEqual([
      "€",
    ]);
  });
});

describe("invokeJsonCliTool", () => {
  it("should return a JSON entity", async () => {
    expect(await invokeJsonCliTool("node", ["-e", "console.log('[1, 2, 3]')"])).toEqual([1, 2, 3]);
  });

  it("should collect all output", async () => {
    expect(
      await invokeJsonCliTool("node", [
        "-e",
        `
          process.stdout.write("{");
          process.stdout.write('"foo":');
          process.stdout.write(' "bar",');
          console.log(' "baz": "qux"');
          process.stdout.write('}');
        `,
      ]),
    ).toEqual({ foo: "bar", baz: "qux" });
    process.stdout.write(Buffer.from([0xac, 0x20]));
  });
});
