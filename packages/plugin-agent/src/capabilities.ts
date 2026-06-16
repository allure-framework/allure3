export const AGENT_CAPABILITIES_SCHEMA = "allure-agent-capabilities/v1";

export const createAgentCapabilities = () =>
  ({
    schema: AGENT_CAPABILITIES_SCHEMA,
    commands: {
      help: {
        supported: true,
        usage: "allure --version; allure agent --help; allure agent capabilities",
        output: ["human", "json"],
      },
      run: {
        supported: true,
        usage: "allure agent [options] -- <command>",
        options: [
          "--config",
          "--cwd",
          "--output",
          "--report",
          "--expectations",
          "--goal",
          "--task-id",
          "--expect-tests",
          "--expect-label",
          "--expect-env",
          "--expect-test",
          "--expect-prefix",
          "--expect-step-containing",
          "--forbid-label",
          "--expect-steps",
          "--expect-attachments",
          "--expect-attachment",
          "--environment",
          "--environment-name",
          "--silent",
          "--rerun-from",
          "--rerun-latest",
          "--rerun-preset",
          "--rerun-environment",
          "--rerun-label",
        ],
      },
      inspect: {
        supported: true,
        usage: "allure agent inspect [options] [<allure-results-dir-or-glob> ...]",
        inputs: ["allure-results-directories", "dump-archives"],
        options: [
          "--config",
          "--cwd",
          "--output",
          "--report",
          "--report-name",
          "--name",
          "--dump",
          "--open",
          "--port",
          "--history-limit",
          "--hide-labels",
          "--expectations",
          "--goal",
          "--task-id",
          "--expect-tests",
          "--expect-label",
          "--expect-env",
          "--expect-test",
          "--expect-prefix",
          "--expect-step-containing",
          "--forbid-label",
          "--expect-steps",
          "--expect-attachments",
          "--expect-attachment",
          "--environment",
          "--environment-name",
        ],
      },
      latest: {
        supported: true,
        usage: "allure agent latest [--cwd <dir>]",
        output: ["agent output: <dir>", "agent index: <dir>/index.md"],
      },
      stateDir: {
        supported: true,
        usage: "allure agent state-dir [--cwd <dir>]",
        environmentVariable: "ALLURE_AGENT_STATE_DIR",
      },
      select: {
        supported: true,
        usage: "allure agent select (--latest | --from <output-dir>) [options]",
        presets: ["review", "failed", "unsuccessful", "all"],
        filters: ["environment", "label"],
        output: ["stdout-testplan-json", "file-testplan-json", "file-summary"],
      },
      query: {
        supported: true,
        usage: "allure agent query (--latest | --from <output-dir>) [summary|tests|findings|test] [options]",
        views: ["summary", "tests", "findings", "test"],
        filters: ["status", "environment", "label", "severity", "category", "check", "test"],
        output: ["json"],
      },
      rerun: {
        supported: true,
        usage: "allure agent (--rerun-latest | --rerun-from <output-dir>) [filters] -- <command>",
        presets: ["review", "failed", "unsuccessful", "all"],
        filters: ["environment", "label"],
        transport: "ALLURE_TESTPLAN_PATH",
      },
    },
    expectations: {
      inline: {
        supported: true,
        goal: true,
        taskId: true,
        expected: {
          testCount: true,
          labels: true,
          environments: true,
          fullNames: true,
          fullNamePrefixes: true,
        },
        forbidden: {
          labels: true,
          environments: false,
          fullNames: false,
          fullNamePrefixes: false,
        },
        evidence: {
          stepNameContains: true,
          minSteps: true,
          minAttachments: true,
          attachmentFilters: ["name", "content-type"],
        },
      },
      file: {
        supported: true,
        formats: ["yaml", "json"],
      },
    },
    output: {
      automaticTempDirectory: true,
      explicitOutputOption: "--output <dir>",
      schema: "allure-agent-output/v1",
      files: [
        "index.md",
        "AGENTS.md",
        "manifest/run.json",
        "manifest/test-events.jsonl",
        "manifest/tests.jsonl",
        "manifest/findings.jsonl",
        "manifest/expected.json",
        "manifest/human-report.json",
        "tests/<environment>/<slug>.md",
        "artifacts/global/",
        "awesome/index.html",
      ],
    },
    humanReports: {
      supported: true,
      option: "--report <auto|off|awesome|config>",
      defaultMode: "auto",
      modes: {
        auto: "Generate a single-file Awesome report when the stored visible result count is 1000 or fewer; skip above that threshold.",
        off: "Disable human-readable reports and write agent artifacts only.",
        awesome: "Force a single-file Awesome report and ignore the auto threshold.",
        config:
          "Force the configured non-agent report plugins inside the agent output directory and ignore the auto threshold.",
      },
      threshold: {
        resultCount: 1000,
        appliesTo: "auto",
        countSource: "Allure store visible logical test results with retries excluded",
        generatedWhen: "<= 1000",
        skippedWhen: "> 1000",
      },
      statusManifest: "manifest/human-report.json",
      defaultGeneratedPath: "awesome/index.html",
      discovery: [
        "When a user asks for a human-readable report after an agent run, first use `allure agent latest` if no output directory is known.",
        "Read `<output>/manifest/human-report.json`, the Human Report section of `<output>/index.md`, or `allure agent query --latest summary` to check whether a report already exists.",
        "If the status is `generated`, use `<output>/<path>` from the human-report manifest; for auto and awesome this is usually `<output>/awesome/index.html`.",
        "If the status is `skipped`, `disabled`, `failed`, or the manifest is missing, generate a report only from available results or dumps with the requested `--report` mode.",
      ],
    },
    unsupported: {
      discovery: true,
      configureIntegration: true,
      executionSignal: true,
      compare: true,
      flaky: true,
      duplicates: true,
      stale: true,
      suppressions: true,
      observe: true,
      interrupt: true,
      localAgentService: true,
      expectationControls: ["--expect-evidence"],
    },
  }) as const;

export const AGENT_TASK_MAP_HELP = `Agent task map:
  allure --version
  allure agent --help
  allure agent capabilities
      Setup and capability detection. Use when the local CLI surface is unknown,
      generated guidance may be stale, or an agent needs supported flags without
      guessing.

  allure agent --goal ... -- <command>
      Run a test command with runtime evidence, scope expectations, and
      agent-readable artifacts for review, debugging, smoke checks, or validation.
      Use --report auto|off|awesome|config to control the optional human report.
      The default --report auto may already generate awesome/index.html in the
      agent output when the stored visible result count is 1000 or fewer.

  allure agent inspect [<allure-results-dir-or-glob> ...]
  allure agent inspect --dump <archive-or-glob> [--dump <archive-or-glob> ...]
      Restore one or more dump archives and/or read existing Allure results
      directories, then produce agent-readable artifacts without executing a
      test command. Use --report auto|off|awesome|config to control the optional
      human report. Use after downloading CI dump artifacts created by
      allure run --dump or when local results already exist.

  allure agent latest
      Recover the newest agent output directory and index.md when --output was
      omitted or a follow-up task needs the previous run. If a user asks for a
      human-readable report from the last run, start here, then inspect
      <output>/manifest/human-report.json and use <output>/<path> when status is
      generated.

  allure agent state-dir
      Show where project-scoped latest-run pointers are stored. Useful when
      latest cannot find a run or CI/sandbox state looks wrong.

  allure agent select --latest
  allure agent select --from <output-dir>
      Inspect/filter prior results and write an Allure test plan before rerun.

  allure agent query --latest summary
  allure agent query --from <output-dir> tests
  allure agent query --from <output-dir> findings
      Inspect prior agent output as focused JSON without manually loading raw
      manifests. Use for summaries, human_report status, filtered test lists,
      findings, or one test.

  allure agent --rerun-latest -- <command>
  allure agent --rerun-from <output-dir> -- <command>
      Rerun the failed, unsuccessful, or selected tests from prior agent output
      through Allure test plan support.

Environment:
  ALLURE_AGENT_STATE_DIR=<dir>
      Override the project-scoped state directory. Useful in CI, sandboxes, or
      multi-job setups that need a deterministic shared state location.

Human reports:
  Default agent runs use --report auto. For 1000 or fewer stored visible logical
  results, the last run may already contain a human-readable single-file Awesome
  report at <output>/awesome/index.html. Larger runs are skipped in auto mode to
  avoid excessive output.

  When a user asks for "the report" after a run, do not assume it needs to be
  regenerated. First run allure agent latest when the output directory is
  unknown, then read <output>/manifest/human-report.json or
  allure agent query --latest summary. If the human-report status is generated,
  return or open <output>/<path> from that manifest. If the status is skipped,
  disabled, failed, or missing, rerun or inspect existing results/dumps with the
  requested --report mode, for example --report awesome to force the single-file
  Awesome report or --report config to force configured report plugins.
`;

export const isAgentTaskMapHelpRequest = (args: string[]) =>
  args.length === 2 && args[0] === "agent" && (args[1] === "--help" || args[1] === "-h");
