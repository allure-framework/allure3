import { scrollFocusIntoView } from "@allurereport/web-commons";
import { useLayoutEffect } from "preact/hooks";

import { getFlatTestResultNode, testResultScrollToId } from "@/stores/testResultOverviewNav";

export const useTestResultOverviewFocusScroll = () => {
  const scrollToId = testResultScrollToId.value;

  useLayoutEffect(() => {
    if (!scrollToId) {
      return;
    }

    const node = document.querySelector(`[data-tr-focus-id="${scrollToId}"]`);

    if (!(node instanceof HTMLElement)) {
      return;
    }

    const flatNode = getFlatTestResultNode(scrollToId);
    scrollFocusIntoView(node, { containerAttribute: "data-tr-scroll-container", kind: flatNode?.kind });
  }, [scrollToId]);
};
