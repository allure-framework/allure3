import { batch, useComputed, useSignal } from "@preact/signals";
import { useCallback, useEffect, useMemo } from "preact/hooks";
import type { Tree, TreeGroup, TreeRow } from "./model";
import { flattenTree } from "./utils";

const DEFAULT_PAGE_SIZE = 30;

export const usePaginated = <T>(items: T[], pageSize: number = DEFAULT_PAGE_SIZE) => {
  const localItems = useSignal(items);
  const page = useSignal(0);
  const hasNextPage = useComputed<boolean>(
    () => localItems.value.length > 0 && (page.value + 1) * pageSize < localItems.value.length,
  );
  const resultItems = useComputed<T[]>(() => localItems.value.slice(0, (page.value + 1) * pageSize));

  useEffect(() => {
    batch(() => {
      localItems.value = items;

      if (localItems.peek().length === items.length) {
        return;
      }

      // Clamp page to valid range so we keep showing as much as user had opened
      const maxPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
      page.value = Math.min(page.peek(), maxPage);
    });
  }, [items, pageSize, localItems, page]);

  const handleNextPage = useCallback(() => {
    if (!hasNextPage.value) {
      return;
    }

    page.value++;
  }, [page, hasNextPage]);

  return [{ items: resultItems, hasNextPage: hasNextPage }, handleNextPage] as const;
};

export const useRows = <T>(tree: Tree<T>, filterGroup?: (node: TreeGroup<T>) => boolean): TreeRow<T>[] => {
  return useMemo(() => flattenTree({ root: tree, filterGroup }), [tree, filterGroup]);
};
