import { writable, derived, type Writable, type Readable } from 'svelte/store';

type CollapseState = Map<string, boolean>;

interface SectionsState {
  collapsedIds: Set<string>;
}

function createSectionsStore() {
  const { subscribe, update, set }: Writable<SectionsState> = writable({
    collapsedIds: new Set<string>()
  });

  return {
    subscribe,
    collapse: (id: string) => {
      update(state => {
        const newCollapsedIds = new Set(state.collapsedIds);
        newCollapsedIds.add(id);
        return { ...state, collapsedIds: newCollapsedIds };
      });
    },
    expand: (id: string) => {
      update(state => {
        const newCollapsedIds = new Set(state.collapsedIds);
        newCollapsedIds.delete(id);
        return { ...state, collapsedIds: newCollapsedIds };
      });
    },
    toggle: (id: string) => {
      update(state => {
        const newCollapsedIds = new Set(state.collapsedIds);
        if (newCollapsedIds.has(id)) {
          newCollapsedIds.delete(id);
        } else {
          newCollapsedIds.add(id);
        }
        return { ...state, collapsedIds: newCollapsedIds };
      });
    },
    collapseAll: (ids: string[]) => {
      update(state => ({
        ...state,
        collapsedIds: new Set(ids)
      }));
    },
    expandAll: () => {
      update(state => ({
        ...state,
        collapsedIds: new Set<string>()
      }));
    },
    isCollapsed: (state: SectionsState, id: string): boolean => {
      return state.collapsedIds.has(id);
    }
  };
}

export const sectionsStore = createSectionsStore();

export const collapsedIds: Readable<Set<string>> = derived(
  sectionsStore,
  $store => $store.collapsedIds
);

export function isSectionCollapsed(id: string): Readable<boolean> {
  return derived(sectionsStore, $store => $store.collapsedIds.has(id));
}
