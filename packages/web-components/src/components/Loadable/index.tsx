import type { LoadableStore } from "@allurereport/web-commons";
import { isLoadableStore, isSignal } from "@allurereport/web-commons";
import type { Signal } from "@preact/signals";
import type { JSX } from "preact";

export interface StoreSignalState<T> {
  error?: string;
  loading: boolean;
  data?: T;
}

export type LoadableProps<T, K = T> = {
  source: Signal<StoreSignalState<T>> | LoadableStore<T>;
  transformData?: (data: T) => K;
  renderData: (data: K) => JSX.Element;
  renderLoader?: () => JSX.Element;
  renderError?: (error: string) => JSX.Element;
};

export const Loadable = <T, K = T>(props: LoadableProps<T, K>) => {
  const {
    source,
    transformData = (responseData: T) => responseData as unknown as K,
    renderLoader = () => null,
    // TODO: https://github.com/qameta/allure3/issues/179
    renderError = (err) => <div>{err}</div>,
    renderData,
  } = props;
  let isLoading = false;
  let error: string | undefined;
  let data: T | undefined;

  if (isSignal(source)) {
    isLoading = source.value.loading;
    error = source.value.error;
    data = source.value.data;
  }

  if (isLoadableStore<T>(source)) {
    isLoading = source.value.loading.value;
    error = source.value.errorMessage.value;
    data = source.value.data.value;
  }

  if (isLoading) {
    return renderLoader();
  }

  if (error) {
    return renderError(error);
  }

  return renderData(transformData(data as T));
};
