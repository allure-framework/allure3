import * as console from "node:console";

import colors from "yoctocolors";

import { registerTerminalHook } from "../utils/terminal-hooks.js";

registerTerminalHook((event) => {
  if (event.kind === "next-step") {
    console.log();
    console.log(colors.bold("Next step:"));
    console.log(`  ${colors.dim(event.text)}`);
    if (event.commands?.length) {
      for (const item of event.commands) {
        const label = item.label ? `${colors.dim(item.label)} ` : "";
        console.log(`  ${label}${colors.cyan(item.command)}`);
      }
    } else if (event.command) {
      console.log(`  ${colors.cyan(event.command)}`);
    }
    console.log();
    return;
  }

  if (event.kind === "message") {
    const color =
      event.level === "success"
        ? colors.green
        : event.level === "warn"
          ? colors.yellow
          : event.level === "error"
            ? colors.red
            : event.level === "hint"
              ? colors.dim
              : colors.cyan;

    console.log(color(event.text));
  }
});
