import type { Plugin, PluginConstructorContext } from "@allurereport/plugin-api";

export type PluginConstructor = new (options?: Record<string, any>, context?: PluginConstructorContext) => Plugin;

const builtinPlugins = new Map<string, PluginConstructor>();

/**
 * Registers a plugin constructor under the given package name (e.g. `@allurereport/plugin-awesome`),
 * so the plugin can be resolved without dynamic module loading.
 * Used by bundled distributions (e.g. Single Executable Applications) where
 * plugins can't be imported from the file system at runtime.
 * @param name
 * @param constructor
 */
export const registerBuiltinPlugin = (name: string, constructor: PluginConstructor): void => {
  builtinPlugins.set(name, constructor);
};

/**
 * Returns the registered plugin constructor for the given package name, if any
 * @param name
 */
export const getBuiltinPlugin = (name: string): PluginConstructor | undefined => {
  return builtinPlugins.get(name);
};
