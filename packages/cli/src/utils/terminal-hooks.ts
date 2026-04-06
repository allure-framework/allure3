export type TerminalHookEvent =
  | {
      kind: "before-command";
      commandId: string;
      payload?: Record<string, unknown>;
    }
  | {
      kind: "after-command";
      commandId: string;
      payload?: Record<string, unknown>;
    }
  | {
      kind: "command-error";
      commandId: string;
      error: unknown;
      payload?: Record<string, unknown>;
    }
  | {
      kind: "message";
      level: "info" | "hint" | "warn" | "error" | "success";
      text: string;
    }
  | {
      kind: "next-step";
      text: string;
      command?: string;
      commands?: { label?: string; command: string }[];
    };

export type TerminalHook = (event: TerminalHookEvent) => void | Promise<void>;

const hooks: TerminalHook[] = [];

export const registerTerminalHook = (hook: TerminalHook): void => {
  hooks.push(hook);
};

export const emitTerminalHookEvent = async (event: TerminalHookEvent): Promise<void> => {
  for (const hook of hooks) {
    try {
      await hook(event);
    } catch {
      // hooks should never break the command execution flow
    }
  }
};

export const runWithTerminalHooks = async <T>(params: {
  commandId: string;
  payload?: Record<string, unknown>;
  run: () => Promise<T>;
}): Promise<T> => {
  await emitTerminalHookEvent({ kind: "before-command", commandId: params.commandId, payload: params.payload });

  try {
    const result = await params.run();
    await emitTerminalHookEvent({ kind: "after-command", commandId: params.commandId, payload: params.payload });
    return result;
  } catch (error) {
    await emitTerminalHookEvent({ kind: "command-error", commandId: params.commandId, error, payload: params.payload });
    throw error;
  }
};
