import clsx from "clsx";

import { testResultFocusId } from "@/stores/testResultOverviewNav";

import * as styles from "@/components/TestResult/trOverviewFocus.scss";

export const isTrOverviewFocused = (id: string | null | undefined) => Boolean(id && testResultFocusId.value === id);

/** Focus ring for a section/step header row only (pass as `className` on the header control). */
export const trOverviewHeaderFocusClass = (id: string | null | undefined, className?: string) =>
  clsx(className, isTrOverviewFocused(id) && styles["tr-overview-focused"]);

export const trOverviewFocusAttrs = (id: string | null | undefined) =>
  id
    ? {
        "data-tr-focus-id": id,
      }
    : {};
