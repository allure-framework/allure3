import { env } from "node:process";
import { fileURLToPath } from "node:url";

import { mergeBlobReports } from "../mergeBlobReports.js";

const rootDirectory = fileURLToPath(new URL("../../../../", import.meta.url));
const mergedDirectory = fileURLToPath(new URL("../../.vitest/merged-blob/", import.meta.url));

const blobPattern = env.VITEST_BLOB_PATTERN;

const count = mergeBlobReports(rootDirectory, mergedDirectory, blobPattern);
console.log(`Collected ${count} unit-test blob reports for merging.`);
