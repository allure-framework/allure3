#!/usr/bin/env node

/**
 * Measure unpacked install size of the local `allure` CLI package (npx-equivalent).
 *
 * Method:
 * 1. Resolve the internal workspace dependency closure for `allure`.
 * 2. Pack each workspace package, inject built `dist/` from the repo, rewrite
 *    `workspace:*` dependency specs to concrete versions, and repack.
 * 3. Install only `allure` in a clean temp project; use npm overrides so every
 *    `@allurereport/*` dependency resolves to the local tarballs. External deps
 *    still come from the npm registry.
 * 4. Measure `du -skL node_modules` (follow symlinks).
 *
 * Usage:
 *   yarn build && yarn allure:size
 *   node scripts/allure-bundle-size.mjs --json
 *   node scripts/allure-bundle-size.mjs --output .ci/allure-bundle-size.json
 *   node scripts/allure-bundle-size.mjs --baseline .ci/allure-bundle-size.baseline.json --max-delta-mb 0.5
 *   node scripts/allure-bundle-size.mjs --update-baseline .ci/allure-bundle-size.baseline.json
 */

import { execSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
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
    baseline: "",
    updateBaseline: "",
    maxDeltaMb: undefined,
    maxSelfDeltaMb: undefined,
    maxDepsDeltaMb: undefined,
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
    } else if (arg === "--baseline") {
      args.baseline = resolve(argv[i + 1] ?? "");
      i += 1;
    } else if (arg === "--update-baseline") {
      args.updateBaseline = resolve(argv[i + 1] ?? "");
      i += 1;
    } else if (arg === "--max-delta-mb") {
      args.maxDeltaMb = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--fail-delta-mb") {
      args.maxDeltaMb = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--max-self-delta-mb") {
      args.maxSelfDeltaMb = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--max-deps-delta-mb") {
      args.maxDepsDeltaMb = Number(argv[i + 1]);
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
  --baseline <path>           Compare against a saved baseline JSON file
  --update-baseline <path>    Save the current measurement as baseline JSON
  --max-delta-mb <number>     Fail when total size exceeds baseline by this many MB
  --fail-delta-mb <number>    Alias for --max-delta-mb
  --max-self-delta-mb <n>    Fail when Allure code footprint exceeds baseline by this many MB
  --max-deps-delta-mb <n>    Fail when external dependencies footprint exceeds baseline by this many MB
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
  red: "\x1b[31m",
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

const formatSign = (value) => (value >= 0 ? `+${value}` : `${value}`);

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

const printPlain = (report, comparison) => {
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

  if (comparison) {
    console.log("");
    if (comparison.passed) {
      console.log(badge(ANSI.green, "OK"));
    } else {
      console.log(badge(ANSI.red, "FAIL"));
    }

    const limitSelfText = comparison.maxSelfDeltaMb === undefined ? "N/A" : `${comparison.maxSelfDeltaMb} MB`;
    const limitDepsText = comparison.maxDepsDeltaMb === undefined ? "N/A" : `${comparison.maxDepsDeltaMb} MB`;
    const limitTotalText = comparison.maxDeltaMb === undefined ? "N/A" : `${comparison.maxDeltaMb} MB`;

    const selfBadge =
      comparison.deltaSelfMb < 0
        ? badge(ANSI.green, "IMPROVED")
        : comparison.passedSelf
          ? badge(ANSI.green, "WITHIN BUDGET")
          : badge(ANSI.red, "REGRESSED");
    const depsBadge =
      comparison.deltaDepsMb < 0
        ? badge(ANSI.green, "IMPROVED")
        : comparison.passedDeps
          ? badge(ANSI.green, "WITHIN BUDGET")
          : badge(ANSI.red, "REGRESSED");
    const totalBadge =
      comparison.deltaMb < 0
        ? badge(ANSI.green, "IMPROVED")
        : comparison.passedTotal
          ? badge(ANSI.green, "WITHIN BUDGET")
          : badge(ANSI.red, "REGRESSED");

    console.log(
      `Allure code: baseline ${comparison.baselineSelfMb} MB, delta ${formatSign(comparison.deltaSelfMb)} MB (limit ${limitSelfText}) ${selfBadge}`,
    );
    console.log(
      `Deps: baseline ${comparison.baselineDepsMb} MB, delta ${formatSign(comparison.deltaDepsMb)} MB (limit ${limitDepsText}) ${depsBadge}`,
    );
    console.log(
      `Total: baseline ${comparison.baselineTotalMb} MB, delta ${formatSign(comparison.deltaMb)} MB (limit ${limitTotalText}) ${totalBadge}`,
    );
  }
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const writeJson = (path, value) => {
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
  const output = execSync(`npm pack -w "${workspaceName}" --pack-destination "${destination}" --ignore-scripts`, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    signal: abortSignal,
  }).trim();

  const tarballName = output.split(/\s+/).pop();
  if (!tarballName) {
    throw new Error(`npm pack did not return a tarball name for ${workspaceName}`);
  }

  return join(destination, tarballName);
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

const measureLocalInstall = (repoRoot, options) => {
  const packages = listWorkspacePackages(repoRoot);
  const closureNames = resolveWorkspaceClosure(packages, ROOT_PACKAGE);

  const missingDist = findMissingDist(packages, closureNames);

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
    execSync("npm install --no-audit --no-fund --ignore-scripts", {
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
      const pkgKb = duKb(pkgDir, abortController.signal);

      const nestedNodeModulesDir = join(pkgDir, "node_modules");
      const nestedKb = existsSync(nestedNodeModulesDir) ? duKb(nestedNodeModulesDir, abortController.signal) : 0;

      selfKb += Math.max(0, pkgKb - nestedKb);
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

const compareWithBaseline = (report, baselinePath, { maxDeltaMb, maxSelfDeltaMb, maxDepsDeltaMb }) => {
  if (!existsSync(baselinePath)) {
    throw new Error(`Baseline file not found: ${baselinePath}`);
  }

  const baseline = readJson(baselinePath);

  const baselineSelfBytes = Number(
    baseline.selfBytes ?? baseline.self_bytes ?? (baseline.selfKb ?? baseline.self_kb ?? 0) * 1024,
  );
  const baselineDepsBytes = Number(
    baseline.depsBytes ?? baseline.deps_bytes ?? (baseline.depsKb ?? baseline.deps_kb ?? 0) * 1024,
  );
  const baselineTotalBytes = Number(
    baseline.totalBytes ?? baseline.total_bytes ?? (baseline.totalKb ?? baseline.total_kb ?? 0) * 1024,
  );

  const deltaSelfBytes = report.selfBytes - baselineSelfBytes;
  const deltaDepsBytes = report.depsBytes - baselineDepsBytes;
  const deltaTotalBytes = report.totalBytes - baselineTotalBytes;

  const maxDeltaBytes = maxDeltaMb === undefined ? undefined : Math.round(maxDeltaMb * 1024 * 1024);
  const maxSelfDeltaBytes = maxSelfDeltaMb === undefined ? undefined : Math.round(maxSelfDeltaMb * 1024 * 1024);
  const maxDepsDeltaBytes = maxDepsDeltaMb === undefined ? undefined : Math.round(maxDepsDeltaMb * 1024 * 1024);

  const baselineSelfMb = Number((baselineSelfBytes / 1024 / 1024).toFixed(2));
  const baselineDepsMb = Number((baselineDepsBytes / 1024 / 1024).toFixed(2));
  const baselineTotalMb = Number((baselineTotalBytes / 1024 / 1024).toFixed(2));

  const deltaSelfMb = Number((deltaSelfBytes / 1024 / 1024).toFixed(2));
  const deltaDepsMb = Number((deltaDepsBytes / 1024 / 1024).toFixed(2));
  const deltaMb = Number((deltaTotalBytes / 1024 / 1024).toFixed(2));

  const passedSelf = maxSelfDeltaMb === undefined ? true : deltaSelfMb <= maxSelfDeltaMb;
  const passedDeps = maxDepsDeltaMb === undefined ? true : deltaDepsMb <= maxDepsDeltaMb;
  const passedTotal = maxDeltaMb === undefined ? true : deltaMb <= maxDeltaMb;

  return {
    baselinePath,
    baselineSelfBytes,
    baselineDepsBytes,
    baselineTotalBytes,
    deltaSelfBytes,
    deltaDepsBytes,
    deltaBytes: deltaTotalBytes,
    baselineSelfMb,
    baselineDepsMb,
    baselineTotalMb,
    deltaSelfMb,
    deltaDepsMb,
    deltaMb,
    passedSelf,
    passedDeps,
    passedTotal,
    passed: passedSelf && passedDeps && passedTotal,
    maxDeltaMb,
    maxSelfDeltaMb,
    maxDepsDeltaMb,
    maxDeltaBytes,
    maxSelfDeltaBytes,
    maxDepsDeltaBytes,
  };
};

const appendGithubStepSummary = (report, comparison) => {
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

  if (comparison) {
    const limitSelfText = comparison.maxSelfDeltaMb === undefined ? "N/A" : `${comparison.maxSelfDeltaMb} MB`;
    const limitDepsText = comparison.maxDepsDeltaMb === undefined ? "N/A" : `${comparison.maxDepsDeltaMb} MB`;
    const limitTotalText = comparison.maxDeltaMb === undefined ? "N/A" : `${comparison.maxDeltaMb} MB`;

    const resultText =
      comparison.passed && (comparison.deltaSelfMb < 0 || comparison.deltaDepsMb < 0 || comparison.deltaMb < 0)
        ? "Result: improved"
        : comparison.passed
          ? "Result: within budget"
          : "Result: size regression";

    lines.push(
      "",
      `Allure code: baseline ${comparison.baselineSelfMb} MB, delta ${comparison.deltaSelfMb >= 0 ? "+" : ""}${comparison.deltaSelfMb} MB (limit ${limitSelfText})`,
      `Deps: baseline ${comparison.baselineDepsMb} MB, delta ${comparison.deltaDepsMb >= 0 ? "+" : ""}${comparison.deltaDepsMb} MB (limit ${limitDepsText})`,
      `Total: baseline ${comparison.baselineTotalMb} MB, delta ${comparison.deltaMb >= 0 ? "+" : ""}${comparison.deltaMb} MB (limit ${limitTotalText})`,
      resultText,
    );
  }

  appendFileSync(summaryPath, `${lines.join("\n")}\n`, "utf8");
};

const main = () => {
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
  let comparison;

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

  if (args.baseline) {
    comparison = compareWithBaseline(report, args.baseline, {
      maxDeltaMb: args.maxDeltaMb,
      maxSelfDeltaMb: args.maxSelfDeltaMb,
      maxDepsDeltaMb: args.maxDepsDeltaMb,
    });
    report.comparison = comparison;
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

    if (r.comparison) {
      payload.comparison = {
        passed: r.comparison.passed,
        passedSelf: r.comparison.passedSelf,
        passedDeps: r.comparison.passedDeps,
        passedTotal: r.comparison.passedTotal,

        baselineSelfBytes: r.comparison.baselineSelfBytes,
        baselineDepsBytes: r.comparison.baselineDepsBytes,
        baselineTotalBytes: r.comparison.baselineTotalBytes,

        deltaSelfBytes: r.comparison.deltaSelfBytes,
        deltaDepsBytes: r.comparison.deltaDepsBytes,
        deltaBytes: r.comparison.deltaBytes,

        maxDeltaBytes: r.comparison.maxDeltaBytes,
        maxSelfDeltaBytes: r.comparison.maxSelfDeltaBytes,
        maxDepsDeltaBytes: r.comparison.maxDepsDeltaBytes,
      };
    }

    return payload;
  };

  const jsonPayload = makeJsonReportPayload(report);

  if (args.output) {
    writeJson(args.output, jsonPayload);
    log(`Report written to ${args.output}`, args.quiet);
  }

  if (args.githubStepSummary) {
    appendGithubStepSummary(report, comparison);
  }

  if (args.json) {
    console.log(JSON.stringify(jsonPayload, null, 2));
  } else {
    // Plain mode must not leak machine-specific paths.
    delete report.repoRoot;
    printPlain(report, comparison);
  }

  if (comparison && !comparison.passed) {
    console.error(
      `Bundle size regression:\n` +
        `- Allure code: baseline ${comparison.baselineSelfMb} MB -> ${report.selfMb} MB (delta ${formatSign(comparison.deltaSelfMb)} MB, limit ${comparison.maxSelfDeltaMb ?? "N/A"} MB)\n` +
        `- Deps: baseline ${comparison.baselineDepsMb} MB -> ${report.depsMb} MB (delta ${formatSign(comparison.deltaDepsMb)} MB, limit ${comparison.maxDepsDeltaMb ?? "N/A"} MB)\n` +
        `- Total: baseline ${comparison.baselineTotalMb} MB -> ${report.totalMb} MB (delta ${formatSign(comparison.deltaMb)} MB, limit ${comparison.maxDeltaMb ?? "N/A"} MB)`,
    );
    process.exit(1);
  }
};

main();
