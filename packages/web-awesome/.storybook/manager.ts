import { addons } from "@storybook/manager-api";
import { create, themes } from "@storybook/theming";
import Logo from "../src/assets/svg/report-logo.svg";

addons.setConfig({
  navSize: 200,
  theme: create({
    base: "light",
    brandTitle: "Allure UI",
    brandImage: Logo,
  }),
});
