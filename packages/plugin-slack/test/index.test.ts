import { story } from "allure-js-commons";
import { beforeEach, it } from "vitest";

beforeEach(async () => {
  await story("index");
});
it.todo("should generate files", async () => {});
