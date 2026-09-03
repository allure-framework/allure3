import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleFilename = fileURLToPath(import.meta.url);
const moduleDirname = path.dirname(moduleFilename);
const generatorRoot = path.resolve(moduleDirname, "..");
const repoRoot = path.resolve(generatorRoot, "..", "..");
const configPath = path.join(generatorRoot, "allurerc-e2e.mjs");

export const e2eRoot = path.join(generatorRoot, "build", "e2e");
const e2eInputRoot = path.join(generatorRoot, "build", "e2e-input");
export const REPORT_MODES = {
  SINGLE_FILE: "single-file",
  DIRECTORY: "directory",
} as const;

export type ReportMode = (typeof REPORT_MODES)[keyof typeof REPORT_MODES];

export interface ReportRequest {
  fixture: string;
  mode: ReportMode;
}

export const DEFAULT_REPORTS: ReportRequest[] = [
  { fixture: "ui-demo", mode: REPORT_MODES.SINGLE_FILE },
  { fixture: "ui-demo", mode: REPORT_MODES.DIRECTORY },
  { fixture: "detected-links", mode: REPORT_MODES.SINGLE_FILE },
  { fixture: "detected-links", mode: REPORT_MODES.DIRECTORY },
  { fixture: "attachments", mode: REPORT_MODES.SINGLE_FILE },
  { fixture: "attachments", mode: REPORT_MODES.DIRECTORY },
  { fixture: "screen-diff", mode: REPORT_MODES.DIRECTORY },
  { fixture: "playwright-trace", mode: REPORT_MODES.SINGLE_FILE },
  { fixture: "playwright-trace", mode: REPORT_MODES.DIRECTORY },
  { fixture: "tree-long-name", mode: REPORT_MODES.DIRECTORY },
  { fixture: "globals-green", mode: REPORT_MODES.SINGLE_FILE },
  { fixture: "globals-green", mode: REPORT_MODES.DIRECTORY },
  { fixture: "globals-no-tests", mode: REPORT_MODES.DIRECTORY },
  { fixture: "globals-attachments", mode: REPORT_MODES.DIRECTORY },
];

const resolveYarnCli = (): string => {
  const environmentCli = process.env.npm_execpath;
  if (environmentCli && /\.[cm]?js$/u.test(environmentCli) && fs.existsSync(environmentCli)) {
    return environmentCli;
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    packageManager?: string;
  };
  const yarnVersion = packageJson.packageManager?.match(/^yarn@(.+)$/u)?.[1];
  const configuredCli = yarnVersion ? path.join(repoRoot, ".yarn", "releases", `yarn-${yarnVersion}.cjs`) : undefined;

  if (configuredCli && fs.existsSync(configuredCli)) {
    return configuredCli;
  }

  throw new Error("Unable to locate the repository Yarn CLI");
};

const runYarn = (args: string[], env: NodeJS.ProcessEnv): void => {
  execFileSync(process.execPath, [resolveYarnCli(), ...args], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
};

const ensureMode = (mode: string): ReportMode => {
  if (!Object.values(REPORT_MODES).includes(mode as ReportMode)) {
    throw new Error(`Unsupported report mode "${mode}"`);
  }

  return mode as ReportMode;
};

export const getFixtureInputDir = (fixture: string): string =>
  path.join(generatorRoot, "tests", "fixtures", "raw", fixture);

const prepareFixtureInput = (fixture: string): string => {
  const sourceDir = getFixtureInputDir(fixture);
  const inputDir = path.join(e2eInputRoot, fixture);
  fs.rmSync(inputDir, { force: true, recursive: true });
  fs.cpSync(sourceDir, inputDir, { recursive: true });

  const historyDir = path.join(sourceDir, "history");
  if (fs.existsSync(historyDir)) {
    fs.readdirSync(historyDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .forEach((entry) => {
        fs.copyFileSync(path.join(historyDir, entry.name), path.join(inputDir, entry.name));
      });
  }

  return inputDir;
};

export const getReportOutputDir = ({ fixture, mode }: ReportRequest): string => path.join(e2eRoot, fixture, mode);

export const getReportIndexPath = ({ fixture, mode }: ReportRequest): string =>
  path.join(getReportOutputDir({ fixture, mode }), "index.html");

export const prepareSingleReport = ({ fixture, mode }: ReportRequest): string => {
  const ensuredMode = ensureMode(mode);
  const sourceDir = getFixtureInputDir(fixture);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Fixture "${fixture}" does not exist at ${sourceDir}`);
  }
  const inputDir = prepareFixtureInput(fixture);

  const outputDir = getReportOutputDir({ fixture, mode: ensuredMode });
  fs.rmSync(outputDir, { force: true, recursive: true });

  runYarn(["allure", "generate", inputDir, `--config=${configPath}`, `--output=${outputDir}`], {
    ...process.env,
    ALLURE2_E2E_SINGLE_FILE: String(ensuredMode === REPORT_MODES.SINGLE_FILE),
    ALLURE_NO_ANALYTICS: "true",
  });

  return getReportIndexPath({ fixture, mode: ensuredMode });
};

const parseCliReports = (argv: string[]): ReportRequest[] => {
  const args: { fixture: string | null; mode: string | null } = {
    fixture: null,
    mode: null,
  };

  argv.forEach((arg) => {
    if (arg.startsWith("--fixture=")) {
      args.fixture = arg.slice("--fixture=".length);
    } else if (arg === "--fixture") {
      args.fixture = "";
    } else if (arg.startsWith("--mode=")) {
      args.mode = arg.slice("--mode=".length);
    } else if (arg === "--mode") {
      args.mode = "";
    }
  });

  const fixtureIndex = argv.indexOf("--fixture");
  if (fixtureIndex !== -1 && argv[fixtureIndex + 1]) {
    args.fixture = argv[fixtureIndex + 1];
  }

  const modeIndex = argv.indexOf("--mode");
  if (modeIndex !== -1 && argv[modeIndex + 1]) {
    args.mode = argv[modeIndex + 1];
  }

  if (!args.fixture && !args.mode) {
    return DEFAULT_REPORTS;
  }

  if (!args.fixture || !args.mode) {
    throw new Error("Both --fixture and --mode are required when preparing a single report");
  }

  return [{ fixture: args.fixture, mode: ensureMode(args.mode) }];
};

export default async function preparePlaywrightReport({
  reports = DEFAULT_REPORTS,
}: { reports?: ReportRequest[] } = {}): Promise<string[]> {
  fs.rmSync(e2eRoot, { force: true, recursive: true });
  fs.rmSync(e2eInputRoot, { force: true, recursive: true });
  fs.rmSync(path.join(generatorRoot, "build", "allure-results"), {
    force: true,
    recursive: true,
  });

  return reports.map(prepareSingleReport);
}

if (process.argv[1] && path.resolve(process.argv[1]) === moduleFilename) {
  void preparePlaywrightReport({ reports: parseCliReports(process.argv.slice(2)) }).catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
