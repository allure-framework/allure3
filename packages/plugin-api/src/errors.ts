/**
 * An error a plugin throws to fail the whole report generation.
 *
 * Any other error thrown by a plugin is only logged, and the report is generated without that plugin.
 * After a `PluginFatalError` the report is still finished, but `AllureReport.done()` rejects afterwards,
 * so the command exits with a non-zero code.
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
