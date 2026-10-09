import { Command } from "clipanion";

import { renderAllure2CommandMap } from "../utils/allure2Hints.js";

export class MigrateCommand extends Command {
  static paths = [["migrate"]];

  static usage = Command.Usage({
    category: "Reports",
    description: "Shows how Allure 2 commands map to Allure 3",
    details:
      "This command prints the Allure 3 equivalents of the Allure 2 commands and options " +
      "(serve, generate --clean, --host, --profile, etc.) for users who are moving from Allure 2.",
    examples: [["migrate", "Print the Allure 2 to Allure 3 command mapping"]],
  });

  async execute() {
    this.context.stdout.write(`${renderAllure2CommandMap()}\n`);
  }
}
