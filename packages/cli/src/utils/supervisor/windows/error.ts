export class ProcessHostOperationError extends Error {
  constructor(
    message?: string,
    readonly fatal?: boolean,
    readonly operation?: string,
    readonly win32Error?: number,
  ) {
    message = message ?? (fatal ? "The process host signaled a fatal error." : "The process host signaled an error.");
    const code = win32Error === undefined ? "" : `(Win32 ${win32Error})`;
    const prefix = operation === undefined ? code : `${operation} ${code}`;
    super(prefix ? `${prefix}: ${message}` : message);
    this.name = "ProcessHostOperationError";
  }
}
