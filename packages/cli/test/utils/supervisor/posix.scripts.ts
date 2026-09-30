export const nodeScripts = {
  descendant: `
    import { rename, stat, writeFile } from "node:fs/promises";
    import { setTimeout as delay } from "node:timers/promises";

    const [readyPath, releasePath] = process.argv.slice(2);
    const temporaryReadyPath = readyPath + "." + process.pid + ".tmp";

    await writeFile(temporaryReadyPath, String(process.pid), "utf-8");
    await rename(temporaryReadyPath, readyPath);

    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        await stat(releasePath);
        process.exit(0);
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }

      await delay(25);
    }

    process.exit(1);
  `,
  rootWithDescendant: `
    import { spawn } from "node:child_process";
    import { stat } from "node:fs/promises";
    import { setTimeout as delay } from "node:timers/promises";

    const [descendantScriptPath, readyPath, releasePath] = process.argv.slice(2);
    const descendant = spawn(process.execPath, [descendantScriptPath, readyPath, releasePath], {
      stdio: "ignore",
    });

    descendant.unref();

    while (true) {
      try {
        await stat(readyPath);
        break;
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }

      await delay(25);
    }
  `,
  threeLevelTree: `
    import { spawn } from "node:child_process";
    import { readFile, rename, writeFile } from "node:fs/promises";
    import { join } from "node:path";
    import { setTimeout as delay } from "node:timers/promises";
    import { fileURLToPath } from "node:url";

    const [levelValue, readyDirectory, sigintMode = "exit"] = process.argv.slice(2);
    const level = Number(levelValue);
    const readyPath = (targetLevel) => join(readyDirectory, \`level-\${targetLevel}.pid\`);
    const sigintPath = (targetLevel) => join(readyDirectory, \`level-\${targetLevel}.sigint\`);
    const gracefulStopReleasePath = join(readyDirectory, "graceful-stop-release");
    const writeProcessId = async (targetPath) => {
      const temporaryPath = targetPath + "." + process.pid + ".tmp";

      await writeFile(temporaryPath, String(process.pid), "utf-8");
      await rename(temporaryPath, targetPath);
    };

    process.once("SIGINT", async () => {
      await writeProcessId(sigintPath(level));

      if (sigintMode === "exit") {
        process.exit(20 + level);
      }

      if (sigintMode === "graceful-stop" && level === 0) {
        await writeFile(gracefulStopReleasePath, "", "utf-8");
        process.exit(20);
      }
    });

    if (level < 2) {
      spawn(process.execPath, [fileURLToPath(import.meta.url), String(level + 1), readyDirectory, sigintMode], {
        stdio: "ignore",
      });

      while (true) {
        try {
          await readFile(readyPath(level + 1), "utf-8");
          break;
        } catch (error) {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }

        await delay(25);
      }
    }

    await writeProcessId(readyPath(level));

    if (sigintMode === "graceful-stop" && level > 0) {
      while (true) {
        try {
          await readFile(gracefulStopReleasePath, "utf-8");
          process.exit(30 + level);
        } catch (error) {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }

        await delay(25);
      }
    }

    await delay(10_000);
  `,
  writeOutputAndExit: `
    const [stdout, stderr, exitCode] = process.argv.slice(1);

    process.stdout.write(stdout);
    process.stderr.write(stderr);
    process.exitCode = Number(exitCode);
  `,
};
