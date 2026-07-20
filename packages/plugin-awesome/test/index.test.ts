import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, it } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("plugin-awesome");
  await story("index");
  await label("coverage", "plugin-awesome");
});

it.todo("should generate files", () => {});
