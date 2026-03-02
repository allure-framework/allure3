/**
 * Run globalSetup from the command line (so spawn works).
 * Usage: from packages/e2e run: node --import tsx test/frontend-backend/run-global-setup.ts
 */
import setup from "./globalSetup.js";

setup().then(
  () => {
    console.log("Setup finished.");
    process.exit(0);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
