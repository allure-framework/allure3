import { SafeString } from "handlebars/runtime.js";
import allureIcon from "./allure-icon.js";

export default function (status = "unknown", ...args) {
  const options = args.pop();
  const chevronIcon = options?.hash?.fat ? "chevronRightFat" : "chevronRight";
  const icon = allureIcon(chevronIcon, {
    hash: {
      noTooltip: true,
      width: "18px",
      height: "18px",
    },
  });
  const template = `<span class="text_status_${status}">${icon}</span>`;

  return new SafeString(template);
}
