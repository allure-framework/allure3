import { cp, copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const demoDirectory = new URL("../out/demo/", import.meta.url);
const devDirectory = new URL("../out/dev/", import.meta.url);
const resultsPath = resolve(process.cwd(), process.env.ALLURE_RESULTS_DIR ?? "../sandbox/allure-results");
const resultsDirectory = pathToFileURL(`${resultsPath}${sep}`);

const readExternalChecks = async () => {
  const fileNames = (await readdir(resultsDirectory)).filter((fileName) => fileName.endsWith("-check.json")).sort();
  const checks = await Promise.all(
    fileNames.map((fileName) => readFile(new URL(fileName, resultsDirectory), "utf8").then(JSON.parse)),
  );

  return Object.fromEntries(checks.map((check) => [check.id, check]));
};

await Promise.all([
  rm(new URL("data/", devDirectory), { recursive: true, force: true }),
  rm(new URL("widgets/", devDirectory), { recursive: true, force: true }),
  rm(new URL("summary.json", devDirectory), { force: true }),
]);
await mkdir(devDirectory, { recursive: true });
await Promise.all([
  cp(new URL("data/", demoDirectory), new URL("data/", devDirectory), { recursive: true }),
  cp(new URL("widgets/", demoDirectory), new URL("widgets/", devDirectory), { recursive: true }),
  copyFile(new URL("summary.json", demoDirectory), new URL("summary.json", devDirectory)),
]);

const externalChecks = await readExternalChecks();

await writeFile(
  new URL("widgets/check-results.json", devDirectory),
  `${JSON.stringify(externalChecks, undefined, 2)}\n`,
);
