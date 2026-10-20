import type { TestStatusTransition } from "@allurereport/core-api";

import { allureIcons } from "@/components/SvgIcon";

export const transitionToIcon = (transition: TestStatusTransition): string => {
  switch (transition) {
    case "new":
      return allureIcons.lineAlertsNew;
    case "fixed":
      return allureIcons.lineAlertsFixed;
    case "regressed":
      return allureIcons.lineAlertsRegressed;
    case "malfunctioned":
      return allureIcons.lineAlertsMalfunctioned;
    default:
      return allureIcons.lineAlertsAlertCircle;
  }
};
