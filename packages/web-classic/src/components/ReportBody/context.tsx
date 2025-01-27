import { type ComponentChildren, createContext } from "preact";
import { useCallback, useContext, useReducer } from "preact/hooks";

export type SortBy = "order" | "duration" | "status" | "alphabet";
export type Direction = "asc" | "desc";
export type Filters = "flaky" | "retry" | "new";

export type ReportContentContextValue = {
  query: string;
  filter: Record<Filters, boolean>;
  sortBy: SortBy;
  direction: Direction;
  setQuery: (query: string) => void;
  setSortBy: (sortBy: SortBy) => void;
  setDirection: (direction: Direction) => void;
  setFilter: (filterKey: Filters, value: boolean) => void;
};

export const ReportContentContext = createContext<ReportContentContextValue | null>(null);

export const useReportContentContext = () => {
  const context = useContext(ReportContentContext);

  if (!context) {
    throw new Error("useReportContentContext must be used within a ReportContentProvider");
  }

  return context;
};

type Actions =
  | {
      type: "setSortBy";
      payload: SortBy;
    }
  | {
      type: "setDirection";
      payload: Direction;
    }
  | {
      type: "setFilter";
      payload: { filterKey: Filters; value: boolean };
    }
  | {
      type: "setQuery";
      payload: string;
    };

type State = Omit<ReportContentContextValue, "setSortBy" | "setDirection" | "setFilter" | "setQuery">;

export const ReportContentProvider = ({ children }: { children: ComponentChildren }) => {
  const [state, dispatch] = useReducer<State, Actions>(
    (state, action): State => {
      switch (action.type) {
        case "setDirection":
          return { ...state, direction: action.payload };
        case "setSortBy":
          return { ...state, sortBy: action.payload };
        case "setFilter":
          return { ...state, filter: { ...state.filter, [action.payload.filterKey]: action.payload.value } };
        case "setQuery":
          return { ...state, query: action.payload };
        default:
          return state;
      }
    },
    {
      query: "",
      direction: "asc",
      filter: {
        flaky: false,
        new: false,
        retry: false,
      },
      sortBy: "alphabet",
    },
  );

  const setSortBy = useCallback((sortBy: SortBy) => dispatch({ type: "setSortBy", payload: sortBy }), []);

  const setDirection = useCallback(
    (direction: Direction) => dispatch({ type: "setDirection", payload: direction }),
    [],
  );

  const setFilter = useCallback(
    (filterKey: Filters, value: boolean) => dispatch({ type: "setFilter", payload: { filterKey, value } }),
    [],
  );

  const setQuery = useCallback((query: string) => dispatch({ type: "setQuery", payload: query }), []);

  return (
    <ReportContentContext.Provider
      value={{
        ...state,
        setSortBy,
        setDirection,
        setFilter,
        setQuery,
      }}
    >
      {children}
    </ReportContentContext.Provider>
  );
};
