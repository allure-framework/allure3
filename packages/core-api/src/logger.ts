/** Common logging contract supported by console and custom loggers. */
export interface AllureLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
