import { ExpressionError } from "@allurereport/core-api";

/** Keep fatal evaluation errors out of the watchers' recoverable-file retry path. */
export const createLiveIngestionFailureHandler = () => {
  let error: ExpressionError | undefined;
  let fail!: (error: ExpressionError) => void;
  const failed = new Promise<ExpressionError>((resolve) => {
    fail = resolve;
  });

  const read = async (readResult: () => Promise<void>) => {
    if (error) return;
    try {
      await readResult();
    } catch (cause) {
      if (!(cause instanceof ExpressionError)) throw cause;
      error ??= cause;
      fail(error);
    }
  };
  const getError = () => error;

  return { failed, read, getError };
};
