# Tree Expand/Collapse All Button - Visual Placement

## Header Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Allure Report Header                                            │
├─────────────────────────────────────────────────────────────────┤
│ [Search Box]                                      [Filters] ⚙   │  ← HeaderActions
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [Total] [Passed] [Failed] [Broken] ... Status Tabs              │
│                                                                  │
│                               [↕] Sort by: Duration Latest      │  ← NEW: TreeControls + SortBy
│                                ↑                                 │
│                           NEW BUTTON                             │
└─────────────────────────────────────────────────────────────────┘
```

## Button States

### Collapsed State (Default)
```
┌───┐
│ ↓ │  ← Chevron Down Icon
└───┘
Tooltip: "Expand all"
```

### Expanded State
```
┌───┐
│ ↑ │  ← Chevron Up Icon
└───┘
Tooltip: "Collapse all"
```

## Component Hierarchy

```
ReportBody
└── Header
    ├── HeaderActions
    │   ├── ReportSearch
    │   └── ReportFilters
    │
    └── headerRow
        ├── ReportTabsList
        │   └── [Status Tabs]
        │
        └── headerControls (NEW wrapper)
            ├── TreeControls (NEW)
            │   └── IconButton
            └── SortBy
                └── Menu/Dropdown
```

## User Flow

```
┌─────────────┐
│ User clicks │
│   button    │
└──────┬──────┘
       │
       ├──────→ If Collapsed: expandAllTrees()
       │        └─→ Clear collapsedTrees & expandedTrees
       │            └─→ All nodes return to default state
       │
       └──────→ If Expanded: collapseAllTrees()
                └─→ Add all node IDs to collapsedTrees
                    └─→ All nodes collapse
```

## Integration Points

1. **Keyboard Shortcuts:** Existing shortcuts (C, A) work from focused node
2. **Tree State:** Uses existing `collapsedTrees`/`expandedTrees` signals
3. **Persistence:** Automatically saved to localStorage
4. **Filters:** Works with status filters and search
5. **Environments:** Handles multiple environment trees

## CSS Classes

- `.treeControls` - Container for the button
- `.headerControls` - Wrapper grouping TreeControls and SortBy
- Inherits button styles from existing IconButton component
