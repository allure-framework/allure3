#!/usr/bin/env node
// Lists keys of src/translations/en.json that are missing in other locales (plural-suffix aware).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/translations");
const PLURAL = /_(zero|one|two|few|many|other)$/;
const flatten = (node, prefix = "", out = new Map()) => {
  for (const [k, v] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, path, out);
    else out.set(path, v);
  }
  return out;
};
const base = (k) => k.replace(PLURAL, "");
const read = (f) => flatten(JSON.parse(readFileSync(join(dir, f), "utf8")));
const en = read("en.json");
const enBases = new Set([...en.keys()].map(base));
const only = process.argv.slice(2);
let total = 0;
for (const file of readdirSync(dir)
  .filter((f) => f.endsWith(".json") && f !== "en.json")
  .sort()) {
  const loc = file.replace(".json", "");
  if (only.length && !only.includes(loc)) continue;
  const have = new Set([...read(file).keys()].map(base));
  const missing = [...enBases].filter((k) => !have.has(k));
  total += missing.length;
  console.log(`${loc}: ${missing.length} missing`);
  if (process.env.VERBOSE) missing.forEach((k) => console.log(`  ${k}`));
}
process.exitCode = total ? 1 : 0;
