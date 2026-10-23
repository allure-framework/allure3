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

    const [descendantScriptPath, readyPath, releasePath, mode] = process.argv.slice(2);
    const descendant = spawn(process.execPath, [descendantScriptPath, readyPath, releasePath], {
      stdio: "ignore",
      detached: mode === "detached",
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
  sigintReporter: `
    import { rename, writeFile } from "node:fs/promises";

    const [readyPath, sigintPath] = process.argv.slice(2);
    const writeProcessId = async (targetPath) => {
      const temporaryPath = targetPath + "." + process.pid + ".tmp";

      await writeFile(temporaryPath, String(process.pid), "utf-8");
      await rename(temporaryPath, targetPath);
    };

    process.once("SIGINT", async () => {
      await writeProcessId(sigintPath);
      process.exit(20);
    });

    await writeProcessId(readyPath);
    setTimeout(() => process.exit(42), 10_000);
  `,
  writeOutputAndExit: `
    const [stdout, stderr, exitCode] = process.argv.slice(1);

    process.stdout.write(stdout);
    process.stderr.write(stderr);
    process.exitCode = Number(exitCode);
  `,
};

export const perlScripts = {
  zombieOnlyProcessGroup: String.raw`
    use strict;
    use warnings;
    use POSIX qw(_exit setsid);

    my ($keeper_pid_path, $zombie_pid_path, $ready_path, $release_path) = @ARGV;

    sub write_file {
      my ($path, $contents) = @_;
      my $temporary_path = $path . "." . $$ . ".tmp";

      open(my $handle, ">", $temporary_path) or die "Unable to open $temporary_path: $!";
      print {$handle} $contents or die "Unable to write $temporary_path: $!";
      close($handle) or die "Unable to close $temporary_path: $!";
      rename($temporary_path, $path) or die "Unable to rename $temporary_path to $path: $!";
    }

    my $keeper_pid = fork();
    defined($keeper_pid) or die "Unable to fork the keeper: $!";

    if ($keeper_pid != 0) {
      my $deadline = time() + 5;
      while (!-e $ready_path && time() < $deadline) {
        select(undef, undef, undef, 0.01);
      }

      -e $ready_path or die "Timed out waiting for the zombie fixture";
      exit(0);
    }

    write_file($keeper_pid_path, $$ . "\n");

    pipe(my $start_reader, my $start_writer) or die "Unable to create the start pipe: $!";

    my $zombie_exited = 0;
    $SIG{CHLD} = sub { $zombie_exited = 1; };

    my $zombie_pid = fork();
    defined($zombie_pid) or die "Unable to fork the zombie: $!";

    if ($zombie_pid == 0) {
      close($start_writer);

      my $start_signal;
      sysread($start_reader, $start_signal, 1) == 1 or _exit(2);
      close($start_reader);
      _exit(0);
    }

    close($start_reader);
    defined(setsid()) or die "Unable to move the keeper outside the supervised process group: $!";
    syswrite($start_writer, "1", 1) == 1 or die "Unable to release the zombie process: $!";
    close($start_writer);

    while (!$zombie_exited) {
      select(undef, undef, undef, 0.01);
    }

    write_file($zombie_pid_path, $zombie_pid . "\n");
    write_file($ready_path, "ready\n");

    my $deadline = time() + 15;
    while (!-e $release_path && time() < $deadline) {
      select(undef, undef, undef, 0.025);
    }

    waitpid($zombie_pid, 0);
    _exit(0);
  `,
};
