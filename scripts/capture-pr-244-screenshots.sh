#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESULTS_DIR="/tmp/allure-244-results"
REPORT_DIR="/tmp/allure-244-report"
CAPTURE_DIR="$ROOT/packages/web-awesome/docs/screenshots/issue-244"
PW_DIR="/tmp/allure-244-playwright"
PORT=9876

rm -rf "$RESULTS_DIR" "$REPORT_DIR" "$PW_DIR"
mkdir -p "$RESULTS_DIR" "$REPORT_DIR" "$CAPTURE_DIR" "$PW_DIR"

python - "$RESULTS_DIR" <<'PY'
import json
import sys
import uuid
from pathlib import Path

results_dir = Path(sys.argv[1])

tests = [
    {
        "name": "0 sample passed test",
        "fullName": "sample.js#0 sample passed test",
        "status": "passed",
        "labels": [
            {"name": "owner", "value": "Igor Martynov"},
            {"name": "feature", "value": "Forms"},
            {"name": "tag", "value": "smoke"},
        ],
        "parameters": [{"name": "browser", "value": "chromium"}],
        "start": 1000,
        "stop": 2000,
    },
    {
        "name": "1 sample failed test",
        "fullName": "UniqueFailedFullName",
        "status": "failed",
        "statusDetails": {"message": "Assertion error: Expected 1 to be 2", "trace": "failed test trace"},
        "start": 5000,
        "stop": 6000,
    },
    {
        "name": "2 sample broken test",
        "fullName": "sample.js#2 sample broken test",
        "status": "broken",
        "statusDetails": {"message": "An unexpected error occurred", "trace": "broken test trace"},
        "start": 9000,
        "stop": 10000,
    },
    {
        "name": "3 sample skipped test",
        "fullName": "sample.js#3 sample skipped test",
        "status": "skipped",
        "start": 13000,
        "stop": 13100,
    },
    {
        "name": "4 sample unknown test",
        "fullName": "sample.js#4 sample unknown test",
        "status": "unknown",
        "start": 17000,
        "stop": 17100,
    },
]

for test in tests:
    payload = {
        "uuid": str(uuid.uuid4()),
        "historyId": str(uuid.uuid4()),
        "testCaseId": str(uuid.uuid4()),
        "stage": "finished",
        **test,
    }
    (results_dir / f"{payload['uuid']}-result.json").write_text(json.dumps(payload), encoding="utf-8")
PY

cd "$ROOT"
yarn allure awesome "$RESULTS_DIR" --output "$REPORT_DIR" --config="$ROOT/packages/web-awesome/allurerc-dev.mjs" >/dev/null

cd "$REPORT_DIR"
python -m http.server "$PORT" >/dev/null 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

cd "$PW_DIR"
npm init -y >/dev/null 2>&1
npm install playwright@1.56.1 >/dev/null 2>&1
npx playwright install chromium >/dev/null 2>&1

ALLURE_CAPTURE_DIR="$CAPTURE_DIR" ALLURE_REPORT_PORT="$PORT" node <<'NODE'
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const captureDir = process.env.ALLURE_CAPTURE_DIR;
const port = process.env.ALLURE_REPORT_PORT;
const url = `http://127.0.0.1:${port}`;

await mkdir(captureDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`${url}/?status=failed&query=${encodeURIComponent("Assertion error")}`);
  await page.locator('[data-testid="tree-leaf"]').first().waitFor();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Clear filters" }).waitFor({ timeout: 10000 });

  await page.locator("[data-tree-sticky-header]").screenshot({
    path: resolve(captureDir, "before-clear-filters-header.png"),
  });
  await page.screenshot({ path: resolve(captureDir, "before-clear-filters.png") });

  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.waitForFunction(() => !Array.from(document.querySelectorAll("button")).some((btn) => btn.textContent?.includes("Clear filters")));
  await page.locator('[data-testid="tree-leaf"]').nth(4).waitFor();

  await page.locator("[data-tree-sticky-header]").screenshot({
    path: resolve(captureDir, "after-clear-filters-header.png"),
  });
  await page.screenshot({ path: resolve(captureDir, "after-clear-filters.png") });

  console.log(`Saved screenshots to ${captureDir}`);
} finally {
  await browser.close();
}
NODE

kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true

echo "Done: $CAPTURE_DIR"
