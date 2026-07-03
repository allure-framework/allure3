import { type PluginConstructor, registerBuiltinPlugin } from "@allurereport/core";
import AgentPlugin from "@allurereport/plugin-agent";
import Allure2Plugin from "@allurereport/plugin-allure2";
import AwesomePlugin from "@allurereport/plugin-awesome";
import ClassicPlugin from "@allurereport/plugin-classic";
import CsvPlugin from "@allurereport/plugin-csv";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import JiraPlugin from "@allurereport/plugin-jira";
import LogPlugin from "@allurereport/plugin-log";
import ProgressPlugin from "@allurereport/plugin-progress";
import ServerReloadPlugin from "@allurereport/plugin-server-reload";
import SlackPlugin from "@allurereport/plugin-slack";

// In a bundled distribution (e.g. Single Executable Application) plugins can't be
// resolved from the file system at runtime, so all first-party plugins shipped with
// the CLI are registered statically before any command runs.
registerBuiltinPlugin("@allurereport/plugin-agent", AgentPlugin);
registerBuiltinPlugin("@allurereport/plugin-allure2", Allure2Plugin);
registerBuiltinPlugin("@allurereport/plugin-awesome", AwesomePlugin);
registerBuiltinPlugin("@allurereport/plugin-classic", ClassicPlugin);
registerBuiltinPlugin("@allurereport/plugin-csv", CsvPlugin);
registerBuiltinPlugin("@allurereport/plugin-dashboard", DashboardPlugin);
registerBuiltinPlugin("@allurereport/plugin-jira", JiraPlugin);
registerBuiltinPlugin("@allurereport/plugin-log", LogPlugin);
registerBuiltinPlugin("@allurereport/plugin-progress", ProgressPlugin);
registerBuiltinPlugin("@allurereport/plugin-server-reload", ServerReloadPlugin as unknown as PluginConstructor);
registerBuiltinPlugin("@allurereport/plugin-slack", SlackPlugin);
