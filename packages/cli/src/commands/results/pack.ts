import { findMatching } from "@allurereport/directory-watcher";
import AdmZip from "adm-zip";
import { Command, Option } from "clipanion";
import { isMatch } from "matcher";
import * as console from "node:console";
import * as fs from "node:fs/promises";
import { realpath } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { green, red } from "yoctocolors";

export class ResultsPackCommand extends Command {
  static paths = [["results", "pack"]];

  static usage = Command.Usage({
    description: "Creates .zip archive with test results",
    category: "Allure Test Results",
    details: "This command creates .zip archive with all test results which can be collected in the project",
    examples: [
      ["results pack", "Creates .zip archive with test results in directories matched to ./**/allure-results pattern"],
      [
        "results pack ./**/foo/**/my-results --name results.zip",
        "Creates results.zip archive with test results in directories matched to ./**/foo/**/my-results pattern",
      ],
    ],
  });

  resultsDir = Option.String({
    required: false,
    name: "Pattern to match test results directories in the current working directory (default: ./**/allure-results)",
  });

  name = Option.String("--name", {
    description: "The archive name (default: allure-results.zip)",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  /**
   * Formats a size in bytes to a human-readable string with appropriate unit (B, KB, MB, GB)
   * @param bytes
   */
  #formatSize(bytes: number): string {
    const units = ["bytes", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    if (bytes === 0) {
      return "0 bytes";
    }

    return unitIndex === 0 ? `${Math.round(size)} ${units[unitIndex]}` : `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  async execute() {
    const cwd = await realpath(this.cwd ?? process.cwd());
    const resultsDir = (this.resultsDir ?? "./**/allure-results").replace(/[\\/]$/, "");
    const archiveName = this.name ?? "allure-results.zip";
    const resultsDirectories = new Set<string>();
    const resultsFiles = new Set<string>();

    await findMatching(cwd, resultsDirectories, (dirent) => {
      if (dirent.isDirectory()) {
        const fullPath = join(dirent?.parentPath ?? dirent?.path, dirent.name);

        return isMatch(fullPath, join(cwd, resultsDir));
      }

      return false;
    });

    if (resultsDirectories.size === 0) {
      console.log(red(`No test results directories found matching pattern: ${resultsDir}`));
      return;
    }

    for (const dir of resultsDirectories) {
      const files = await fs.readdir(dir);

      if (files.length === 0) {
        continue;
      }

      for (const file of files) {
        resultsFiles.add(resolve(dir, file));
      }
    }

    const outputPath = join(cwd, archiveName);
    const zip = new AdmZip();

    for (const file of resultsFiles) {
      try {
        const stats = await fs.stat(file);

        if (stats.isFile()) {
          zip.addLocalFile(file, "", basename(file));
        }
      } catch (error) {
        console.log(red(`Error adding file ${file} to archive: ${(error as Error).message}`));
      }
    }

    try {
      zip.writeZip(outputPath);

      const stats = await fs.stat(outputPath);

      console.log(green(`Archive created successfully: ${outputPath}`));
      console.log(
        green(`Total size: ${this.#formatSize(stats.size)}. ${resultsFiles.size} results files have been collected`),
      );
    } catch (err) {
      console.log(red(`Error creating archive: ${(err as Error).message}`));
      throw err;
    }
  }
}
