import { attachment, step } from "allure-js-commons";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";

beforeAll(async () => {
  await step("beforeAll 1", () => {});
  await step("beforeAll 2", () => {});
  await attachment("beforeAll 3", "beforeAll attachment", "text/plain");
});

afterAll(async () => {
  await step("afterAll 1", () => {});
  await step("afterAll 2", () => {});
  await attachment("afterAll 3", "afterAll attachment", "text/plain");
});

describe("folder 1", () => {
  beforeEach(async () => {
    await step("beforeEach (folder 1) 1", () => {});
    await step("beforeEach (folder 1) 2", () => {});
    await attachment("beforeEach (folder 1) 3", "beforeEach (folder 1) attachment", "text/plain");
  });

  afterEach(async () => {
    await step("afterEach (folder 1) 1", () => {});
    await step("afterEach (folder 1) 2", () => {});
    await attachment("afterEach (folder 1) 3", "afterEach (folder 1) attachment", "text/plain");
  });

  describe("folder 2", () => {
    beforeEach(async () => {
      await step("beforeEach (folder 2) 1", () => {});
      await step("beforeEach (folder 2) 2", () => {});
      await attachment("beforeEach (folder 2) 3", "beforeEach (folder 2) attachment", "text/plain");
    });

    afterEach(async () => {
      await step("afterEach (folder 2) 1", () => {});
      await step("afterEach (folder 2) 2", () => {});
      await attachment("afterEach (folder 2) 3", "afterEach (folder 2) attachment", "text/plain");
    });

    describe("folder 3", () => {
      beforeEach(async () => {
        await step("beforeEach (folder 3) 1", () => {});
        await step("beforeEach (folder 3) 2", () => {});
        await attachment("beforeEach (folder 3) 3", "beforeEach (folder 3) attachment", "text/plain");
      });

      afterEach(async () => {
        await step("afterEach (folder 3) 1", () => {});
        await step("afterEach (folder 3) 2", () => {});
        await attachment("afterEach (folder 3) 3", "afterEach (folder 3) attachment", "text/plain");
      });

      it("test", async () => {
        await step("test 1", () => {});
        await step("test 2", () => {});
        await attachment("test 3", "test attachment", "text/plain");
      });
    });
  });
});
