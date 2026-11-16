/**
 * An error a plugin throws to fail the whole report generation.
 *
 * It is only honoured in the `prepare` hook: the failure is recorded as a global error and a non-zero exit code
 * before any report is written, the report is still finished, and `AllureReport.done()` rejects afterwards, so the
 * command exits with a non-zero code. Thrown from any other hook, it is only logged like any other plugin error.
 */
export class PluginFatalError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PluginFatalError";
  }
}

/**
 * Checks the error by its name too, because a plugin may be built against another copy of the plugin API
 */
export const isPluginFatalError = (error: unknown): error is Error =>
  error instanceof PluginFatalError || (error instanceof Error && error.name === "PluginFatalError");
