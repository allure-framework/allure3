import * as console from "node:console";
import * as fs from "node:fs/promises";
import { realpath } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { exit } from "node:process";

import { readRawConfig } from "@allurereport/core";
import AdmZip from "adm-zip";
import { Command, Option } from "clipanion";
import { green, red } from "yoctocolors";

import { resolveAndFindResultsDirs } from "../../utils/resultsPatterns.js";

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
    name: "Pattern to match test results directories. Overrides config.resultsDir. Defaults to ./**/allure-results when neither is set.",
  });

  name = Option.String("--name", {
    description: "The archive name (default: allure-results.zip)",
  });

  config = Option.String("--config,-c", {
    description: "The path to Allure config file",
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
    const rawConfig = await readRawConfig(cwd, this.config);
    const cliPatterns = this.resultsDir ? [this.resultsDir] : [];
    const { resultDirectories, patterns } = await resolveAndFindResultsDirs(cwd, cliPatterns, rawConfig.resultsDir);
    const archiveName = this.name ?? "allure-results.zip";
    const resultsFiles = new Set<string>();

    if (resultDirectories.length === 0) {
      // eslint-disable-next-line no-console
      console.error(red(`No test results directories found matching pattern: ${patterns}`));
      exit(1);
      return;
    }

    for (const dir of resultDirectories) {
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
