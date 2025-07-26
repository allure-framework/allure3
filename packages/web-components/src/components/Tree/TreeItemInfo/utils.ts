import type { TestStatusTransition } from "@allurereport/core-api";
import { allureIcons } from "@/components/SvgIcon";
import type { TagSkin } from "@/components/Tag";

export const transitionToTagSkin = (transition: TestStatusTransition): TagSkin | undefined => {
  switch (transition) {
    case "new":
      return "neutral-light";
    case "fixed":
      return "successful-light";
    case "regressed":
      return "failed-light";
    case "malfunctioned":
      return "warning-light";
    default:
      return undefined;
  }
};

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
