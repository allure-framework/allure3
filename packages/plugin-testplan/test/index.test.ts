import { story } from "allure-js-commons";
import { beforeEach, it } from "vite-plus/test";

beforeEach(async () => {
  await story("index");
});
it.todo("should generate testplan.json", async () => {});
