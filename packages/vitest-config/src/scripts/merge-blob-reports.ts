import { fileURLToPath } from "node:url";

import { mergeBlobReports } from "../mergeBlobReports.js";

const rootDirectory = fileURLToPath(new URL("../../../../", import.meta.url));
const mergedDirectory = fileURLToPath(new URL("../../coverage/merged-blob/", import.meta.url));

const count = mergeBlobReports(rootDirectory, mergedDirectory);
console.log(`Collected ${count} unit-test blob reports for merging.`);
