export class SupervisorOperationError extends Error {
  constructor(
    message?: string,
    readonly fatal?: boolean,
    readonly operation?: string,
    readonly win32Error?: number,
  ) {
    message =
      message ??
      (fatal ? "The process supervisor signaled a fatal error." : "The process supervisor signaled an error.");
    const code = win32Error === undefined ? "" : `(Win32 ${win32Error})`;
    const prefix = operation === undefined ? code : `${operation} ${code}`;
    super(prefix ? `${prefix}: ${message}` : message);
    this.name = "SupervisorOperationError";
  }
}
