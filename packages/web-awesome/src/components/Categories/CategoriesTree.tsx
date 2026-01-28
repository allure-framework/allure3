import type { CategoryNode } from "@allurereport/core-api";
import type { FC } from "preact/compat";
import { useEffect, useMemo } from "preact/hooks";
import { CategoryTreeItem } from "@/components/Categories/CategoryTreeItem";
import { route } from "@/stores/router";
import * as styles from "./styles.scss";

const buildParentsIndex = (nodes: Record<string, CategoryNode>) => {
  const parents: Record<string, string[]> = {};
  for (const [pid, n] of Object.entries(nodes)) {
    for (const cid of n.childrenIds ?? []) {
      (parents[cid] ??= []).push(pid);
    }
  }
  return parents;
};

const findPathToRoot = (focusId: string, roots: string[], parents: Record<string, string[]>) => {
  const visited = new Set<string>();
  const q: { id: string; path: string[] }[] = [{ id: focusId, path: [focusId] }];

  while (q.length) {
    const cur = q.shift()!;
    if (visited.has(cur.id)) {
      continue;
    }
    visited.add(cur.id);

    if (roots.includes(cur.id)) {
      return cur.path.slice().reverse();
    } // root->...->focus

    for (const p of parents[cur.id] ?? []) {
      q.push({ id: p, path: [p, ...cur.path] });
    }
  }
  return null;
};

export const CategoriesTree: FC<{ store: any }> = ({ store }) => {
  const activeNodeId = route.value.params?.nodeId ?? null;
  const parents = useMemo(() => buildParentsIndex(store.nodes), [store]);

  useEffect(() => {
    if (!activeNodeId) {
      return;
    }
    const path = findPathToRoot(activeNodeId, store.roots, parents);
    if (!path) {
      return;
    }
  }, [activeNodeId, parents, store.roots]);

  return (
    <div className={styles["categories-tree-view"]}>
      {store.roots.map((id: string) => (
        <CategoryTreeItem key={id} nodeId={id} store={store} activeNodeId={activeNodeId ?? undefined} />
      ))}
    </div>
  );
};
