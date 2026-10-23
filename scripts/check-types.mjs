import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const packages = readdirSync(new URL("../packages/", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const sourceRoots = packages
  .filter((name) => existsSync(new URL(`../packages/${name}/src/`, import.meta.url)))
  .map((name) => `packages/${name}/src`);
const excludedPackages = packages.filter((name) => !sourceRoots.includes(`packages/${name}/src`));

if (sourceRoots.length === 0) {
  throw new Error("No production source roots found for type checking");
}

console.error(`Checking production types in ${sourceRoots.length} package source roots`);
if (excludedPackages.length > 0) {
  console.error(`Packages without src (excluded): ${excludedPackages.join(", ")}`);
}

const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(import.meta.resolve("vite-plus/bin")),
    "lint",
    "--type-check",
    ...sourceRoots,
    "--ignore-pattern",
    "**/*.test.*",
    ...process.argv.slice(2),
  ],
  { cwd: root, stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
