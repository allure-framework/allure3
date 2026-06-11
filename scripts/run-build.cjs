#!/usr/bin/env node

const { spawn } = require("node:child_process");

const startedAt = process.hrtime.bigint();
const command = ["yarn", "workspaces", "foreach", "-Apt", "run", "build"];

console.log("Build in progress...");

const child = spawn(command[0], command.slice(1), {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";

child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  output += chunk;
});

const fallbackDuration = () => {
  const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
  const seconds = Math.floor(durationMs / 1000);
  const ms = durationMs % 1000;

  return `Done in ${seconds}s ${ms}ms`;
};

const finalDoneLine = () => {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.findLast((line) => /^Done in \d/.test(line)) ?? fallbackDuration();
};

child.on("close", (code, signal) => {
  const doneLine = finalDoneLine();

  if (code === 0 && signal === null) {
    console.log(doneLine);
    return;
  }

  console.error("Build failed.");

  const failureOutput = output
    .split(/\r?\n/)
    .filter((line) => !/^Done in \d/.test(line.trim()))
    .join("\n")
    .trim();

  if (failureOutput) {
    console.error(failureOutput);
  }

  console.error("");
  console.error(doneLine);
  process.exit(typeof code === "number" ? code : 1);
});

child.on("error", (error) => {
  console.error("Build failed.");
  console.error(error.message);
  console.error(fallbackDuration());
  process.exit(1);
});
