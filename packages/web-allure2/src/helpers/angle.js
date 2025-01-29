import { SafeString } from "handlebars/runtime.js";
import allureIcon from "./allure-icon.js";

export default function () {
  const icon = allureIcon("chevronRight", {
    hash: {
      noTooltip: true,
      width: "18px",
      height: "18px",
    },
  });
  const template = `<span class="angle">${icon}</span>`;

  return new SafeString(template);
}
