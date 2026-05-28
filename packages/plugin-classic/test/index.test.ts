import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, it } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("plugin-classic");
  await story("index");
  await label("coverage", "plugin-classic");
});

it.todo("should generate files", () => {});
