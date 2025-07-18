import type { TestStatusTransition } from "@allurereport/core-api";
import type { TagSkin } from "@/components/Tag";
import { allureIcons } from "@/components/SvgIcon";

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
