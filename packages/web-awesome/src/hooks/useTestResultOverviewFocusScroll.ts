import { scrollFocusIntoView } from "@allurereport/web-commons";
import { useLayoutEffect } from "preact/hooks";

import { getFlatTestResultNode, testResultFocusId } from "@/stores/testResultOverviewNav";

export const useTestResultOverviewFocusScroll = () => {
  const focusId = testResultFocusId.value;

  useLayoutEffect(() => {
    if (!focusId) {
      return;
    }

    const node = document.querySelector(`[data-tr-focus-id="${focusId}"]`);

    if (!(node instanceof HTMLElement)) {
      return;
    }

    const flatNode = getFlatTestResultNode(focusId);
    scrollFocusIntoView(node, { containerAttribute: "data-tr-scroll-container", kind: flatNode?.kind });
  }, [focusId]);
};
