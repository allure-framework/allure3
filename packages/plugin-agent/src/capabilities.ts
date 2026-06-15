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
        "tests/<environment>/<slug>.md",
        "artifacts/global/",
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

  allure agent inspect [<allure-results-dir-or-glob> ...]
  allure agent inspect --dump <archive-or-glob> [--dump <archive-or-glob> ...]
      Restore one or more dump archives and/or read existing Allure results
      directories, then produce agent-readable artifacts without executing a
      test command. Use after downloading CI dump artifacts created by
      allure run --dump or when local results already exist.

  allure agent latest
      Recover the newest agent output directory and index.md when --output was
      omitted or a follow-up task needs the previous run.

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
      manifests. Use for summaries, filtered test lists, findings, or one test.

  allure agent --rerun-latest -- <command>
  allure agent --rerun-from <output-dir> -- <command>
      Rerun the failed, unsuccessful, or selected tests from prior agent output
      through Allure test plan support.

Environment:
  ALLURE_AGENT_STATE_DIR=<dir>
      Override the project-scoped state directory. Useful in CI, sandboxes, or
      multi-job setups that need a deterministic shared state location.
`;

export const isAgentTaskMapHelpRequest = (args: string[]) =>
  args.length === 2 && args[0] === "agent" && (args[1] === "--help" || args[1] === "-h");
