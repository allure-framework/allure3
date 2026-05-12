import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, it } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("plugin-allure2");
  await story("index");
  await label("coverage", "plugin-allure2");
});

it.todo("should generate files", () => {});
