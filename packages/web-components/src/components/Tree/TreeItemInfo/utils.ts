import type { TestStatusTransition } from "@allurereport/core-api";
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
