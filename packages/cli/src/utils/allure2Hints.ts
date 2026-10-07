/**
 * Hints for users who come from Allure 2 and try the commands and options that were renamed or removed in Allure 3.
 * The hint is printed after the usual "unsupported option" / "command not found" error, nothing is emulated silently.
 */
const OPTION_HINTS: Record<string, string> = {
  "--clean":
    "`allure generate` doesn't clean the output directory. Remove it yourself (e.g. `rm -rf allure-report`) " +
    "or use `allure run`, which recreates the output directory on every launch.",
  "--verbose":
    "There is no verbose mode in Allure 3. `allure run` has `--silent` and `--ignore-logs` for the opposite.",
  "-v": "There is no verbose mode in Allure 3. Use `allure --version` to print the version.",
  "--quiet": "There is no quiet mode in Allure 3. `allure run` has `--silent` and `--ignore-logs`.",
  "-q": "There is no quiet mode in Allure 3. `allure run` has `--silent` and `--ignore-logs`.",
  "--profile": "Profiles are gone. Use a single allurerc file and pass it with `--config`.",
  "--configDirectory": "The config directory is gone. Use a single allurerc file and pass it with `--config`.",
  "--lang":
    "`generate` and `run` have no `--lang`. Set `reportLanguage` in the plugin options of allurerc, " +
    "or use a plugin command like `allure awesome --lang <code>`.",
  "--report-language":
    "`generate` and `run` have no `--report-language`. Set `reportLanguage` in the plugin options of allurerc, " +
    "or use a plugin command like `allure awesome --report-language <code>`.",
  "--single-file":
    "`generate` and `run` have no `--single-file`. Set `singleFile` in the plugin options of allurerc, " +
    "or use a plugin command like `allure awesome --single-file`.",
};

/**
 * What an Allure 2 command line turns into in Allure 3
 */
export const ALLURE2_COMMAND_MAP: readonly { allure2: string; allure3: string; note: string }[] = [
  {
    allure2: "allure serve <results>",
    allure3: "allure open <results>",
    note: "Generates the report into a temp directory and serves it. For live updates use `allure watch <results>`",
  },
  {
    allure2: "allure generate <results> -o <dir>",
    allure3: "allure generate <results> -o <dir>",
    note: "Same command. Add `--open` to serve the report afterwards. The output directory is not cleaned",
  },
  {
    allure2: "allure generate <results> --clean",
    allure3: "rm -rf <dir> && allure generate <results> -o <dir>",
    note: "There is no `--clean`. `allure run` recreates the output directory on every launch",
  },
  {
    allure2: "allure open <report>",
    allure3: "allure open <report>",
    note: "Same command. Serves an already generated report",
  },
  {
    allure2: "allure serve|open --host <host> --port <port>",
    allure3: "allure open --host <host> --port <port>",
    note: "`--host` and `--port` are also available for `generate --open`, `run` and `watch`, and in allurerc",
  },
  {
    allure2: "run tests, then allure serve",
    allure3: "allure run -- <test command>",
    note: "Runs the tests, collects results into a report, and serves it with `--open`",
  },
  {
    allure2: "allure generate --single-file --lang <code>",
    allure3: "allure awesome <results> --single-file --lang <code>",
    note: "Or set `singleFile` and `reportLanguage` in the plugin options of allurerc",
  },
  {
    allure2: "--profile <name>, --configDirectory <dir>, allure.yml",
    allure3: "--config <path to allurerc>",
    note: "One config file with plugins, report options and quality gates instead of profiles",
  },
  {
    allure2: "allure plugin",
    allure3: "`plugins` section of allurerc",
    note: "Plugins are enabled and configured in the config file",
  },
  {
    allure2: "--verbose, --quiet",
    allure3: "allure run --silent / --ignore-logs",
    note: "No global verbosity switches",
  },
];

export const renderAllure2CommandMap = () =>
  [
    "Allure 2 -> Allure 3",
    "",
    ...ALLURE2_COMMAND_MAP.flatMap(({ allure2, allure3, note }) => [
      `  ${allure2}`,
      `    -> ${allure3}`,
      `       ${note}`,
      "",
    ]),
  ].join("\n");

const COMMAND_HINTS: Record<string, string> = {
  plugin: "There is no `allure plugin` command. Plugins are listed in the `plugins` section of allurerc.",
  report:
    "Allure 3 has no `allure report` group. Use `allure generate` to build a report and `allure open` to serve it.",
};

const UNSUPPORTED_OPTION_RE = /Unsupported option name \("([^"]+)"\)/;

/**
 * Returns an Allure 2 migration hint for the failed CLI invocation, or undefined when there is nothing to suggest
 */
export const getAllure2Hint = (args: readonly string[], errorMessage: string): string | undefined => {
  const optionMatch = UNSUPPORTED_OPTION_RE.exec(errorMessage);

  if (optionMatch) {
    // Allure 2 accepted `--option=value`, clipanion reports only the option name
    return OPTION_HINTS[optionMatch[1]];
  }

  if (/Command not found/i.test(errorMessage) && args[0] !== undefined) {
    return COMMAND_HINTS[args[0]];
  }

  return undefined;
};

export const ALLURE2_MIGRATE_REMINDER = "Run `allure migrate` to see how Allure 2 commands map to Allure 3.";
