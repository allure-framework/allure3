import { attachment, historyId, label, link, step } from "allure-js-commons";
import { describe, expect, it } from "vitest";

const suites = ["auth", "payments", "orders", "infra", "ui", "reporting"];
const envs = ["foo", "bar", "default"];
const owners = ["alice", "bob", "carol", "dave"];
const severities = ["blocker", "critical", "normal", "minor"];
const layers = ["api", "ui", "service"];
const tags = ["smoke", "regression", "e2e", "perf"];
const epics = ["checkout", "identity", "billing"];
const features = ["create", "update", "delete", "read"];
const stories = ["happy path", "edge case", "validation", "security"];

const failedMessages = [
  "expected 200 to be 502 // Object.is equality",
  "expected true to be false // Object.is equality",
  "ValidationError: missing address.zip",
  "AssertionError: mismatch in payload",
  "By cities, Kâmiare in the world, with people under 25 making up the then larger Armenian population, we expected valid values but received malformed payloads across multiple services (auth, payments, orders, infra) and the assertion failed after retries.",
];

const brokenMessages = [
  "ECONNRESET: socket hang up",
  "TimeoutException: gateway did not respond",
  "java.net.ConnectException: Connection refused",
  "Visual diff exceeded threshold",
  "UnexpectedError: long running task exceeded SLA while processing batched requests and recalculating derived metrics; investigation needed for queue backpressure and downstream timeouts.",
];

const pick = <T>(arr: readonly T[], seed: number) => arr[seed % arr.length];

let index = 0;

for (const suite of suites) {
  for (const env of envs) {
    for (let i = 0; i < 30; i += 1) {
      const seed = index;
      index += 1;
      const owner = pick(owners, seed);
      const severity = pick(severities, seed);
      const layer = pick(layers, seed);
      const tag = pick(tags, seed);
      const name = `${suite}/${env} — case ${i + 1}`;
      const variant = seed % 10;

      it(name, async (ctx) => {
        await label("env", env);
        await label("owner", owner);
        await label("severity", severity);
        await label("layer", layer);
        await label("tag", tag);
        await label("epic", pick(epics, seed));
        await label("feature", pick(features, seed));
        await label("story", pick(stories, seed));
        await label("component", pick(suites, seed));
        await label("thread", `worker-${seed % 8}`);
        await label("host", `host-${seed % 5}`);
        await link(`JIRA-${100 + (seed % 50)}`, `https://example.org/browse/JIRA-${100 + (seed % 50)}`);

        // Exercise "most recent wins" for labels
        await label("owner", `${owner}-override`);

        await step("setup", () => {});
        await step("action", () => {});
        await attachment("payload", JSON.stringify({ suite, env, owner, severity, layer, tag }), "application/json");

        if (variant === 0) {
          ctx.skip();
        }

        const isFlakyCandidate = seed % 6 === 0;
        if (isFlakyCandidate) {
          const outcome = Math.random();
          if (outcome < 0.2) {
            throw new Error(pick(brokenMessages, seed));
          }
          if (outcome < 0.6) {
            await attachment("assertion", pick(failedMessages, seed), "text/plain");
            expect(true).toBe(false);
          }
        } else {
          if (variant <= 2) {
            throw new Error(pick(brokenMessages, seed));
          }
          if (variant <= 4) {
            await attachment("assertion", pick(failedMessages, seed), "text/plain");
            expect(true).toBe(false);
          }
        }

        expect(true).toBe(true);
      });
    }
  }
}

const sharedCases = [
  { name: "shared case A", envs: ["foo", "bar"], history: "shared-case-a" },
  { name: "shared case B", envs: ["foo", "bar", "default"], history: "shared-case-b" },
];

for (const shared of sharedCases) {
  for (const [envIndex, env] of shared.envs.entries()) {
    it(shared.name, async () => {
      await historyId(shared.history);
      await label("env", env);
      await label("owner", "shared-owner");
      await label("severity", pick(severities, envIndex));
      await label("layer", pick(layers, envIndex));
      await label("tag", "shared");
      await step("shared setup", () => {});
      await step("shared action", () => {});

      if (envIndex === 0) {
        await attachment("assertion", pick(failedMessages, envIndex), "text/plain");
        expect(true).toBe(false);
      }
      if (envIndex === 1) {
        throw new Error(pick(brokenMessages, envIndex));
      }
    });
  }
}

describe("history group", () => {
  const envPairs = ["foo", "bar"];
  for (const [envIndex, env] of envPairs.entries()) {
    it("multi env case", async () => {
      await historyId("multi-env-case");
      await label("env", env);
      await label("owner", "history-group");
      await label("severity", "critical");
      await label("layer", "api");
      await step("history setup", () => {});

      await attachment("assertion", pick(failedMessages, envIndex), "text/plain");
      expect(true).toBe(false);
    });
  }
});
