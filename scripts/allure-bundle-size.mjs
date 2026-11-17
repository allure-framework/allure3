#!/usr/bin/env node

/**
 * Measure unpacked install size of the local `allure` CLI package (npx-equivalent).
 *
 * Method:
 * 1. Resolve the internal workspace dependency closure for `allure`.
 * 2. Pack each workspace package with Yarn to resolve catalogs, inject built
 *    `dist/` from the repo, rewrite `workspace:*` dependency specs to concrete
 *    versions, and repack.
 * 3. Install only `allure` in a clean temp project; use npm overrides so every
 *    `@allurereport/*` dependency resolves to the local tarballs. External deps
 *    still come from the npm registry.
 * 4. Measure `du -skL node_modules` (follow symlinks).
 *
 * Usage:
 *   yarn build && yarn allure:size
 *   node scripts/allure-bundle-size.mjs --json
 *   node scripts/allure-bundle-size.mjs --allure-results out/bundle-size-results
 *   node scripts/allure-bundle-size.mjs --update-baseline .ci/allure-bundle-size.baseline.json
 */

import { execFileSync, execSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { clearLine, cursorTo } from "node:readline";
import { fileURLToPath } from "node:url";

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 24) {
  console.error(`Node.js >= 24 is required for scripts/allure-bundle-size.mjs (found ${process.versions.node}).`);
  process.exit(1);
}

const ROOT_PACKAGE = "allure";
const ROOT_WORKSPACE = "packages/cli";

const parseArgs = (argv) => {
  const args = {
    repoRoot: process.cwd(),
    json: false,
    quiet: false,
    progress: false,
    includeClosure: false,
    ci: false,
    emojis: false,
    keepTemp: false,
    output: "",
    allureResults: "",
    updateBaseline: "",
    githubStepSummary: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      args.json = true;
    } else if (arg === "--format") {
      const format = argv[i + 1] ?? "";
      i += 1;
      if (format !== "plain" && format !== "json") {
        throw new Error(`Invalid --format value: "${format}". Expected "plain" or "json".`);
      }
      args.json = format === "json";
    } else if (arg === "--quiet") {
      args.quiet = true;
    } else if (arg === "--progress") {
      args.progress = true;
    } else if (arg === "--include-closure") {
      args.includeClosure = true;
    } else if (arg === "--closure") {
      args.includeClosure = true;
    } else if (arg === "--ci") {
      args.ci = true;
    } else if (arg === "--emojis") {
      args.emojis = true;
    } else if (arg === "--keep-temp") {
      args.keepTemp = true;
    } else if (arg === "--github-step-summary") {
      args.githubStepSummary = true;
    } else if (arg === "--repo-root") {
      args.repoRoot = resolve(argv[i + 1] ?? "");
      i += 1;
    } else if (arg === "--output") {
      args.output = resolve(argv[i + 1] ?? "");
      i += 1;
    } else if (arg === "--allure-results") {
      args.allureResults = resolve(argv[i + 1] ?? "");
      i += 1;
    } else if (arg === "--update-baseline") {
      args.updateBaseline = resolve(argv[i + 1] ?? "");
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  // In JSON mode the CLI must be clean: no progress logs on stderr/stdout.
  if (args.json) {
    args.quiet = true;
  }

  // CI mode: always clean machine output + always add GitHub summary.
  if (args.ci) {
    args.json = true;
    args.quiet = true;
    args.githubStepSummary = true;
  }

  // Disable emojis in CI by design (even if --emojis is provided).
  if (process.env.CI) {
    args.emojis = false;
  }

  return args;
};

const printHelp = () => {
  console.log(`Usage: node scripts/allure-bundle-size.mjs [options]

Options:
  --format <plain|json>       Output format (alias: --json)
  --json                      Print JSON report to stdout (quiet automatically)
  --quiet                     Suppress progress logs
  --progress                  Enable animated packing progress bar
  --include-closure          Include internal workspace package list in JSON
  --closure                   Alias for --include-closure
  --ci                         CI mode (clean JSON + GITHUB_STEP_SUMMARY)
  --emojis                    Enable emoji decorations (disabled in CI)
  --keep-temp                 Keep the temp install directory
  --repo-root <path>          Repository root (default: cwd)
  --output <path>             Write JSON report to a file
  --allure-results <dir>      Write measured sizes as Allure metrics
  --update-baseline <path>    Save the current measurement as baseline JSON
  --github-step-summary       Append a markdown summary to GITHUB_STEP_SUMMARY
  --help, -h                  Show this help
`);
};

const log = (message, quiet) => {
  if (!quiet) {
    console.error(message);
  }
};

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;
const style = (start, text) => (supportsColor ? `${start}${text}${ANSI.reset}` : text);
const bold = (text) => style(ANSI.bold, text);
const color = (code, text) => style(code, text);
const badge = (code, text) => bold(color(code, text));
const dim = (text) => style(ANSI.gray, text);

const makeInterruptedError = () => {
  const err = new Error("Interrupted");
  err.code = 130;
  return err;
};

const createProgressBar = (total, enabled, doneText) => {
  if (!enabled) {
    return {
      tick: () => {},
      done: () => {},
    };
  }

  const width = 28;
  let current = 0;

  const render = (label = "") => {
    const ratio = total === 0 ? 1 : current / total;
    const complete = Math.round(ratio * width);
    const incomplete = width - complete;
    const bar = `${"=".repeat(complete)}${"-".repeat(incomplete)}`;
    const percent = String(Math.round(ratio * 100)).padStart(3, " ");
    const meta = `${String(current).padStart(2, " ")}/${String(total).padEnd(2, " ")}`;
    const suffix = label ? ` ${label}` : "";
    const line = `${dim("Packing")} [${bar}] ${percent}% ${meta}${suffix}`;
    cursorTo(process.stderr, 0);
    clearLine(process.stderr, 0);
    process.stderr.write(line);
  };

  return {
    tick: (label = "") => {
      current += 1;
      render(label);
    },
    done: () => {
      cursorTo(process.stderr, 0);
      clearLine(process.stderr, 0);
      process.stderr.write(color(ANSI.green, doneText));
      process.stderr.write("\n");
    },
  };
};

const printPlain = (report) => {
  // Separate progress output from the final report.
  console.log("");
  const sep = "----------------------------------------------------------------------------";
  console.log(bold(color(ANSI.cyan, "Allure bundle size")));
  console.log(dim(`Root: ${report.rootPackage}`));
  console.log(dim(`Workspace closure: ${report.internalClosureCount} packages`));
  console.log(sep);
  console.log(dim("Allure code = internal packages, excluding their external dependencies."));
  console.log(`${dim("Allure code:")}  ${color(ANSI.magenta, formatBytesForConsole(report.selfBytes))}`);
  console.log(`${dim("Dependencies:")}  ${color(ANSI.magenta, formatBytesForConsole(report.depsBytes))}`);
  console.log(`${dim("Total:")}         ${bold(formatBytesForConsole(report.totalBytes))}`);
  console.log(dim(`node_modules:  ${report.nodeModulesTopLevelEntries} top-level entries`));

  if (report.missingDist?.length) {
    console.log("");
    console.log(badge(ANSI.yellow, "Warning"));
    console.log(`Missing dist/ for ${report.missingDist.length} workspace package(s):`);
    for (const name of report.missingDist) {
      console.log(`  - ${name}`);
    }
    console.log(dim("Tip: run `yarn build` before measuring for accurate results."));
  }
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const listWorkspacePackages = (repoRoot) => {
  const packagesRoot = join(repoRoot, "packages");
  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesRoot, entry.name, "package.json"))
    .filter((packageJsonPath) => existsSync(packageJsonPath))
    .map((packageJsonPath) => {
      const packageJson = readJson(packageJsonPath);
      const packageDir = dirname(packageJsonPath);
      return { packageJson, packageDir };
    });
};

const resolveWorkspaceClosure = (packages, rootName) => {
  const byName = new Map(packages.map((item) => [item.packageJson.name, item]));
  const closure = new Set([rootName]);
  const queue = [rootName];

  while (queue.length > 0) {
    const name = queue.pop();
    const item = byName.get(name);
    if (!item) {
      continue;
    }

    const deps = {
      ...(item.packageJson.dependencies ?? {}),
      ...(item.packageJson.optionalDependencies ?? {}),
    };
    for (const depName of Object.keys(deps)) {
      if (byName.has(depName) && !closure.has(depName)) {
        closure.add(depName);
        queue.push(depName);
      }
    }
  }

  return [...closure].sort();
};

const rewriteWorkspaceDependencies = (packageJson, versionsByName) => {
  const next = structuredClone(packageJson);
  for (const section of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    const deps = next[section];
    if (!deps) {
      continue;
    }

    for (const [depName, depSpec] of Object.entries(deps)) {
      if (typeof depSpec === "string" && depSpec.startsWith("workspace:")) {
        const version = versionsByName.get(depName);
        if (!version) {
          throw new Error(`Unable to resolve workspace dependency ${depName} for ${next.name}`);
        }
        deps[depName] = version;
      }
    }
  }

  return next;
};

const packWorkspace = (repoRoot, workspaceName, destination, abortSignal) => {
  const tarballPath = join(destination, `${workspaceName.replace("/", "-")}.tgz`);
  execSync(`yarn workspace "${workspaceName}" pack --out "${tarballPath}"`, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    signal: abortSignal,
  });

  return tarballPath;
};

const extractTarball = (tarballPath, extractRoot, abortSignal) => {
  rmSync(extractRoot, { recursive: true, force: true });
  execSync(`mkdir -p "${extractRoot}" && tar -xzf "${tarballPath}" -C "${extractRoot}"`, {
    stdio: "ignore",
    signal: abortSignal,
  });
  return join(extractRoot, "package");
};

const repackWithDist = (repoRoot, workspaceName, workspaceDir, packDestination, extractRoot, abortSignal) => {
  const initialTarball = packWorkspace(repoRoot, workspaceName, packDestination, abortSignal);
  const packageRoot = extractTarball(initialTarball, extractRoot, abortSignal);

  const localDist = join(workspaceDir, "dist");
  const extractedDist = join(packageRoot, "dist");
  if (existsSync(localDist)) {
    rmSync(extractedDist, { recursive: true, force: true });
    cpSync(localDist, extractedDist, { recursive: true });
  }

  const repackedName = execSync("npm pack --ignore-scripts", {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    signal: abortSignal,
  }).trim();

  return join(packageRoot, repackedName);
};

const resolveTarballs = (repoRoot, packages, closureNames, packDestination, extractRoot, options) => {
  const byName = new Map(packages.map((item) => [item.packageJson.name, item]));
  const versionsByName = new Map(closureNames.map((name) => [name, byName.get(name).packageJson.version]));
  const tarballsByName = new Map();
  const canUseProgressBar = options.progress && !options.quiet && process.stderr.isTTY && supportsColor;
  const packingDoneText = `${options.emojis ? "✅" : ""}Packing done!`;
  const progress = createProgressBar(closureNames.length, canUseProgressBar, packingDoneText);
  let i = 0;
  const abortSignal = options.abortSignal;

  if (!options.quiet && !canUseProgressBar) {
    console.error(`Packing ${closureNames.length} workspace package(s) for size measurement...`);
  }
  for (const name of closureNames) {
    i += 1;
    if (abortSignal?.aborted) {
      throw makeInterruptedError();
    }
    const item = byName.get(name);
    if (!options.quiet && !canUseProgressBar) {
      const shouldLog = i === 1 || i === closureNames.length || i % 5 === 0;
      if (shouldLog) {
        console.error(`  Packing ${i}/${closureNames.length}: ${name}`);
      }
    }

    const tarballPath = repackWithDist(
      repoRoot,
      name,
      item.packageDir,
      packDestination,
      join(extractRoot, name.replace("/", "__")),
      abortSignal,
    );

    const resolvedRoot = join(extractRoot, `${name.replace("/", "__")}-resolved`);
    const packageRoot = extractTarball(tarballPath, resolvedRoot, abortSignal);
    writeJson(
      join(packageRoot, "package.json"),
      rewriteWorkspaceDependencies(readJson(join(packageRoot, "package.json")), versionsByName),
    );

    const resolvedTarballName = execSync("npm pack --ignore-scripts", {
      cwd: packageRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      signal: abortSignal,
    }).trim();

    tarballsByName.set(name, join(packageRoot, resolvedTarballName));
    progress.tick(name);
  }
  progress.done();
  if (!options.quiet && !canUseProgressBar) {
    console.error(color(ANSI.green, packingDoneText));
  }

  return tarballsByName;
};

const duKb = (targetPath, abortSignal) => {
  const output = execSync(`du -skL "${targetPath}"`, { encoding: "utf8", signal: abortSignal }).trim();
  const kb = Number(output.split(/\s+/)[0]);
  if (Number.isNaN(kb)) {
    throw new Error(`Unable to parse du output for ${targetPath}: ${output}`);
  }
  return kb;
};

const kbToMb = (kb) => Number((kb / 1024).toFixed(2));

const formatBytesForConsole = (bytes) => {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) {
    const kbExact = Math.round(bytes / 1024);
    return `${mb.toFixed(2)} MB ${dim(`(${kbExact} KB)`)}`;
  }
  const kb = bytes / 1024;
  if (kb >= 1) {
    // Console requirement: show KB only when > 1KB
    return `${kb.toFixed(0)} KB`;
  }
  return `${bytes} B`;
};

const countNodeModulesEntries = (nodeModulesPath) =>
  readdirSync(nodeModulesPath).filter((entry) => !entry.startsWith(".")).length;

const findMissingDist = (packages, closureNames) => {
  const byName = new Map(packages.map((item) => [item.packageJson.name, item]));
  const missing = [];

  for (const name of closureNames) {
    const item = byName.get(name);
    if (!item) {
      continue;
    }

    const hasBuildScript = Boolean(item.packageJson.scripts?.build);
    const distPath = join(item.packageDir, "dist");
    if (hasBuildScript && !existsSync(distPath)) {
      missing.push(name);
    }
  }

  return missing;
};

// Entry points can contain conditions and fallback arrays.
const entryTargets = (entry) => {
  if (typeof entry === "string") {
    return entry.includes("*") ? [] : [entry];
  }
  return entry && typeof entry === "object" ? Object.values(entry).flatMap(entryTargets) : [];
};

const validateInstalledPackage = (packageDir) => {
  const manifest = readJson(join(packageDir, "package.json"));
  const exports = manifest.exports;
  const rootExport = exports && Object.keys(exports).some((key) => key.startsWith(".")) ? exports["."] : exports;
  for (const target of new Set([manifest.main, manifest.module, manifest.bin, rootExport].flatMap(entryTargets))) {
    if (!statSync(join(packageDir, target), { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`Missing installed entry point ${manifest.name}: ${target}`);
    }
  }
};

const measureLocalInstall = (repoRoot, options) => {
  const packages = listWorkspacePackages(repoRoot);
  const closureNames = resolveWorkspaceClosure(packages, ROOT_PACKAGE);

  const missingDist = findMissingDist(packages, closureNames);
  if ((options.updateBaseline || options.allureResults) && missingDist.length > 0) {
    throw new Error(`Missing dist/ for: ${missingDist.join(", ")}`);
  }

  const abortController = new AbortController();
  const onInterrupt = () => {
    abortController.abort();
    try {
      process.stderr.write(`\r${" ".repeat(120)}\r\n`);
    } catch {
      // noop
    }
  };
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  const tempRoot = mkdtempSync(join(tmpdir(), "allure-bundle-size-"));
  const packDestination = join(tempRoot, "packs");
  const extractRoot = join(tempRoot, "extract");
  const installDir = join(tempRoot, "install");
  mkdirSync(packDestination, { recursive: true });
  mkdirSync(extractRoot, { recursive: true });
  mkdirSync(installDir, { recursive: true });

  try {
    const tarballsByName = resolveTarballs(repoRoot, packages, closureNames, packDestination, extractRoot, {
      ...options,
      abortSignal: abortController.signal,
    });

    const overrides = {};
    for (const name of closureNames) {
      if (name !== ROOT_PACKAGE) {
        overrides[name] = `file:${tarballsByName.get(name)}`;
      }
    }

    writeFileSync(
      join(installDir, "package.json"),
      `${JSON.stringify(
        {
          name: "allure-bundle-size-check",
          private: true,
          dependencies: {
            [ROOT_PACKAGE]: `file:${tarballsByName.get(ROOT_PACKAGE)}`,
          },
          overrides,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const showInstallInPlace = !options.quiet && process.stderr.isTTY;
    const installStartText = "Installing local allure with npm overrides...";
    if (showInstallInPlace) {
      cursorTo(process.stderr, 0);
      clearLine(process.stderr, 0);
      process.stderr.write(installStartText);
    } else {
      log(installStartText, options.quiet);
    }
    execSync("npm install --prefer-offline --no-audit --no-fund --ignore-scripts", {
      cwd: installDir,
      stdio: "ignore",
      signal: abortController.signal,
    });
    if (abortController.signal.aborted) {
      throw makeInterruptedError();
    }
    if (!options.quiet) {
      const installDoneText = `${options.emojis ? "✅" : ""}Installing local allure done!`;
      if (showInstallInPlace) {
        cursorTo(process.stderr, 0);
        clearLine(process.stderr, 0);
        process.stderr.write(color(ANSI.green, installDoneText));
        process.stderr.write("\n");
      } else {
        console.error(color(ANSI.green, installDoneText));
      }
    }

    const nodeModulesPath = join(installDir, "node_modules");
    const totalKb = duKb(nodeModulesPath, abortController.signal);

    // "Self code" = internal workspace packages footprint excluding any nested node_modules
    // (if a package contains its own node_modules, its deps are not "our code").
    let selfKb = 0;
    for (const pkgName of closureNames) {
      const pkgDir = join(nodeModulesPath, pkgName);
      if (options.updateBaseline || options.allureResults) {
        validateInstalledPackage(pkgDir);
      }
      const pkgKb = duKb(pkgDir, abortController.signal);

      const nestedNodeModulesDir = join(pkgDir, "node_modules");
      const nestedKb = existsSync(nestedNodeModulesDir) ? duKb(nestedNodeModulesDir, abortController.signal) : 0;

      selfKb += Math.max(0, pkgKb - nestedKb);
    }

    if (options.updateBaseline || options.allureResults) {
      const cliPackageDir = join(nodeModulesPath, ROOT_PACKAGE);
      const { bin } = readJson(join(cliPackageDir, "package.json"));
      const cli = typeof bin === "string" ? bin : bin[ROOT_PACKAGE];
      execFileSync(process.execPath, [join(cliPackageDir, cli), "--version"], {
        cwd: installDir,
        stdio: ["ignore", "ignore", "inherit"],
        signal: abortController.signal,
      });
    }

    const depsKb = Math.max(0, totalKb - selfKb);
    const selfBytes = selfKb * 1024;
    const depsBytes = depsKb * 1024;
    const totalBytes = totalKb * 1024;

    return {
      measuredAt: new Date().toISOString(),
      repoRoot,
      rootPackage: ROOT_PACKAGE,
      internalClosureCount: closureNames.length,
      internalClosure: options.includeClosure ? closureNames : undefined,
      nodeModulesTopLevelEntries: countNodeModulesEntries(nodeModulesPath),
      selfBytes,
      depsBytes,
      totalBytes,
      selfKb,
      depsKb,
      totalKb,
      selfMb: kbToMb(selfKb),
      depsMb: kbToMb(depsKb),
      totalMb: kbToMb(totalKb),
      missingDist,
      tempDir: options.keepTemp ? tempRoot : undefined,
    };
  } catch (err) {
    if (abortController.signal.aborted) {
      throw makeInterruptedError();
    }
    throw err;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onInterrupt);
    if (!options.keepTemp) {
      rmSync(tempRoot, { recursive: true, force: true });
    } else {
      log(`Temp directory kept at ${tempRoot}`, options.quiet);
    }
  }
};

const appendGithubStepSummary = (report) => {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  const lines = [
    "## Allure bundle size",
    "",
    "| Metric | Size |",
    "| --- | ---: |",
    `| Allure code | ${report.selfMb} MB |`,
    `| Dependencies | ${report.depsMb} MB |`,
    `| Total | ${report.totalMb} MB |`,
  ];

  appendFileSync(summaryPath, `${lines.join("\n")}\n`, "utf8");
};

const main = async () => {
  const args = parseArgs(process.argv);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const defaultRepoRoot = resolve(scriptDir, "..");
  const repoRoot = args.repoRoot === process.cwd() ? defaultRepoRoot : args.repoRoot;

  if (!existsSync(join(repoRoot, ROOT_WORKSPACE, "package.json"))) {
    console.error(`Unable to find ${ROOT_WORKSPACE}/package.json under ${repoRoot}`);
    process.exit(1);
  }

  let report;
  try {
    report = measureLocalInstall(repoRoot, args);
  } catch (err) {
    if (err?.code === 130 || err?.message === "Interrupted" || err?.signal === "SIGINT" || err?.signal === "SIGTERM") {
      process.exit(130);
    }
    throw err;
  }

  const makeBaselinePayload = (r) => ({
    rootPackage: r.rootPackage,
    measuredAt: r.measuredAt,
    internalClosureCount: r.internalClosureCount,
    // Raw bytes only: consumers can compute MB/KB deltas themselves if needed.
    selfBytes: r.selfBytes,
    depsBytes: r.depsBytes,
    totalBytes: r.totalBytes,
  });

  if (args.updateBaseline) {
    writeJson(args.updateBaseline, makeBaselinePayload(report));
    log(`Baseline updated at ${args.updateBaseline}`, args.quiet);
  }

  const makeJsonReportPayload = (r) => {
    const payload = {
      rootPackage: r.rootPackage,
      measuredAt: r.measuredAt,
      internalClosureCount: r.internalClosureCount,
      selfBytes: r.selfBytes,
      depsBytes: r.depsBytes,
      totalBytes: r.totalBytes,
    };

    if (r.internalClosure) {
      payload.internalClosure = r.internalClosure;
    }
    if (r.missingDist?.length) {
      payload.missingDist = r.missingDist;
    }

    return payload;
  };

  const jsonPayload = makeJsonReportPayload(report);

  if (args.output) {
    writeJson(args.output, jsonPayload);
    log(`Report written to ${args.output}`, args.quiet);
  }

  if (args.allureResults) {
    const { FileSystemWriter } = await import("allure-js-commons/sdk/reporter");
    const writer = new FileSystemWriter({ resultsDir: args.allureResults });
    const timestamp = Date.parse(report.measuredAt);
    const metrics = Object.entries({
      "allure.bundle.size.self": report.selfBytes,
      "allure.bundle.size.dependencies": report.depsBytes,
      "allure.bundle.size.total": report.totalBytes,
    }).map(([key, value]) => ({ id: key, key, value, start: timestamp, stop: timestamp }));
    writer.writeMetricResults("bundle-size-metric.json", metrics);
  }

  if (args.githubStepSummary) {
    appendGithubStepSummary(report);
  }

  if (args.json) {
    console.log(JSON.stringify(jsonPayload, null, 2));
  } else {
    // Plain mode must not leak machine-specific paths.
    delete report.repoRoot;
    printPlain(report);
  }
};

await main();
