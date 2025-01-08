import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const buildResourcePath = (path: string) => resolve(__dirname, "./resources", path);

export const readResource = async (path: string) => readFile(buildResourcePath(path));

export const resources = [
  ["sample.png", "image/png"],
  ["sample.gif", "image/gif"],
  ["sample.png", "image/png"],
  ["sample.tiff", "image/tiff"],
  ["sample.jpeg", "image/jpeg"],
  ["sample.svg", "image/svg+xml"],
];
