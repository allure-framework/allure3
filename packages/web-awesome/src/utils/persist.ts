class AllurePersistError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = "AllurePersistError";
  }

  get message(): string {
    return `${this.name}: ${this.message}${this.originalError ? `\n${this.originalError.message}` : ""}`;
  }
}

export const persist = <T>(pair: [string, T], storage: Storage = localStorage) => {
  const [key, value] = pair;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(new AllurePersistError(`Failed to persist ${key} to ${storage.name}`, e as Error));
  }
};
