import { addons } from "@storybook/manager-api";
import { create, themes } from "@storybook/theming";

addons.setConfig({
  navSize: 200,
  theme: create({
    base: "light",
    brandTitle: "Allure UI",
  }),
});
