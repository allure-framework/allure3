import type { TestStatusTransition } from "@allurereport/core-api";
import type { TagSkin } from "@/components/Tag";

export const transitionToTagSkin = (transition: TestStatusTransition): TagSkin | undefined => {
  switch (transition) {
    case "new":
      return "neutral";
    case "fixed":
      return "successful";
    case "regressed":
      return "failed";
    case "malfunctioned":
      return "warning";
    default:
        return undefined;
  }
};
