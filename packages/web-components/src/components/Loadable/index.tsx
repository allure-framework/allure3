import type { Signal } from "@preact/signals";
import type { JSX } from "preact";

export interface StoreSignalState<T> {
  error?: string;
  loading: boolean;
  data?: T;
}

export type LoadableProps<T, K = T> = {
  source: Signal<StoreSignalState<T>>;
  transformData?: (data: T) => K;
  renderData: (data: K) => JSX.Element;
  renderLoader?: () => JSX.Element;
  renderError?: (error: string) => JSX.Element;
};

export const Loadable = <T, K = T>(props: LoadableProps<T, K>) => {
  const {
    source,
    transformData = (data: T) => data as unknown as K,
    renderLoader = () => null,
    // TODO: https://github.com/qameta/allure3/issues/179
    renderError = (err) => <div>{err}</div>,
    renderData,
  } = props;

  if (source.value.loading) {
    return renderLoader();
  }

  if (source.value.error) {
    return renderError(source.value.error);
  }

  return renderData(transformData(source.value.data as T));
};
