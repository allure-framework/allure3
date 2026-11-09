import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { type TreeStore, suitesTree } from "@/stores/tree";

/**
 * Provides the store of the tree rendered on the current page (Suites, Behaviors, Packages or Categories),
 * so the shared header actions and tree components work with the right data, filters and sorting
 */
export const TreeStoreContext = createContext<TreeStore>(suitesTree);

export const useTreeStore = () => useContext(TreeStoreContext);
