import AdmZip from "adm-zip";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import * as fs from "node:fs/promises";
import { realpath } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { green, red } from "yoctocolors";

export class ResultsUnpackCommand extends Command {
  static paths = [["results", "unpack"]];

  static usage = Command.Usage({
    description: "Extracts test results from .zip archives",
    category: "Allure Test Results",
    details: "This command extracts test results from .zip archives to the specified output directory",
    examples: [
      ["results unpack", "Extract test results from allure-results.zip to the default directory (./allure-results)"],
      [
        "results unpack results.zip",
        "Extract test results from results.zip to the default directory (./allure-results)",
      ],
      [
        "results unpack results1.zip results2.zip results3.zip",
        "Extract test results from multiple archives to the default directory",
      ],
      [
        "results unpack --output ./mydir results1.zip results2.zip results3.zip",
        "Extract test results from multiple archives to the specified directory (./mydir)",
      ],
    ],
  });

  output = Option.String("--output", "./allure-results", {
    description: "Output directory where the archives should be unarchived to (default: ./allure-results)",
  });

  archives = Option.Rest();

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? process.cwd());
    const outputDir = resolve(cwd, this.output);
    const archives = this.archives.length > 0 ? this.archives : ["allure-results.zip"];

    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (ignored) {}

    let successCount = 0;
    let failCount = 0;

    for (const archivePath of archives) {
      const resolvedPath = resolve(cwd, archivePath);

      try {
        await fs.access(resolvedPath);

        console.log(`Extracting ${resolvedPath} to ${outputDir}`);

        try {
          const zip = new AdmZip(resolvedPath);
          zip.extractAllTo(outputDir, true); // true means overwrite existing files

          console.log(green(`Successfully extracted ${basename(resolvedPath)}`));
          successCount++;
        } catch (err) {
          console.log(red(`Error extracting ${basename(resolvedPath)}: ${(err as Error).message}`));
          failCount++;
        }
      } catch (error) {
        console.log(red(`Error accessing archive ${resolvedPath}: ${(error as Error).message}`));
        failCount++;
      }
    }

    console.log(green(`Extraction complete. Successfully extracted ${successCount} archive(s).`));

    if (failCount > 0) {
      console.log(red(`Failed to extract ${failCount} archive(s).`));
      return;
    }
  }
}
