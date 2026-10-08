import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const srcDir = join(__dirname, "../src");
const distDir = join(__dirname, "../dist");

const assets = [
  "utils/supervisor/windows/supervisor.ps1",
  "utils/supervisor/windows/supervisor.cs",
  "utils/supervisor/windows/worker.ps1",
  "utils/supervisor/windows/send-console-signal.ps1",
];

for (const asset of assets) {
  const sourcePath = join(srcDir, asset);
  const destinationPath = join(distDir, asset);
  const destinationDirPath = dirname(destinationPath);

  await mkdir(destinationDirPath, { recursive: true });
  await copyFile(sourcePath, destinationPath);
}
