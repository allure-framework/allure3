import "allure-vitest/setup";
import { attachment, step } from "allure-js-commons";
import { afterEach, beforeEach, expect } from "vitest";

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const emitNestedStepBranch = async (branchName: string, seed: number) => {
  await step(`${branchName}: orchestration`, async () => {
    await step("layer-1: collect input", async () => {
      await attachment(
        `${branchName}-input.json`,
        JSON.stringify(
          {
            seed,
            branchName,
            payload: { userId: `user-${seed % 7}`, retries: seed % 3, featureFlags: ["alpha", "beta"] },
          },
          null,
          2,
        ),
        "application/json",
      );

      await step("layer-2: enrich context", async () => {
        await step("layer-3: execute transport", async () => {
          await step("layer-4: validate response schema", () => {});
        });
      });
    });
  });
};

const emitNestedBrokenBranch = async (seed: number) => {
  await step("broken subtree (caught)", async () => {
    await step("broken layer-1", async () => {
      await step("broken layer-2", async () => {
        await step("broken layer-3", async () => {
          throw new Error(`sandbox synthetic nested error: ${seed}`);
        });
      });
    });
  }).catch(() => undefined);
};

const emitNestedFailedBranch = async (seed: number) => {
  await step("failed subtree (caught)", async () => {
    await step("failed layer-1", async () => {
      await step("failed layer-2", async () => {
        await step("failed layer-3", () => {
          expect(seed % 2).toBe(3);
        });
      });
    });
  }).catch(() => undefined);
};

beforeEach(async () => {
  const testName = expect.getState().currentTestName ?? "sandbox test";
  const seed = hashString(testName);

  await step("sandbox prelude: deep nested steps", async () => {
    await emitNestedStepBranch("primary", seed);
    await emitNestedStepBranch("secondary", seed + 17);

    if (seed % 2 === 0) {
      await emitNestedBrokenBranch(seed);
    } else {
      await emitNestedFailedBranch(seed);
    }
  });
});

afterEach(async () => {
  const testName = expect.getState().currentTestName ?? "sandbox test";
  const seed = hashString(`${testName}:after`);

  await step("sandbox epilogue: post-check nested steps", async () => {
    await step("post layer-1", async () => {
      await step("post layer-2", async () => {
        await attachment("post-check.txt", `post-check for "${testName}" with seed ${seed}\n`, "text/plain");
      });
    });
  });
});
