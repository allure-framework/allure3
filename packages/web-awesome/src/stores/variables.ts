import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

export type Variables = Record<string, any>;

export const variables = signal<StoreSignalState<Record<string, Variables>>>({
  loading: false,
  error: undefined,
  data: undefined,
});

export const fetchVariables = async (env: string = "default") => {
  variables.value = {
    ...variables.peek(),
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<string[]>(env ? `widgets/${env}/variables.json` : "widgets/variables.json", {
      bustCache: true,
    });

    variables.value = {
      data: {
        ...variables.peek().data,
        [env]: res,
      },
      error: undefined,
      loading: false,
    };
  } catch (e) {
    variables.value = {
      ...variables.peek(),
      error: e.message,
      loading: false,
    };
  }
};
