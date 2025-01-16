export interface StoreSignalState<T> {
  error?: string;
  loading: boolean;
  data?: T;
}
