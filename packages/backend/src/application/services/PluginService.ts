export interface PluginInfo {
  name: string;
  type: 'reader' | 'aggregator' | 'extension';
  version: string;
  path: string;
}

export class PluginService {
  private plugins: Map<string, PluginInfo> = new Map();

  async loadPlugins(pluginPaths: string[]): Promise<void> {
    // Plugin loading logic will be implemented in Infrastructure layer
    // This is a placeholder for the interface
    for (const path of pluginPaths) {
      // Load plugin from path
      // Register plugin
    }
  }

  async applyPlugins(data: any, pluginType: 'reader' | 'aggregator' | 'extension'): Promise<any> {
    // Apply plugins of specified type
    // This will be implemented with actual plugin system
    return data;
  }

  getAvailablePlugins(): PluginInfo[] {
    return Array.from(this.plugins.values());
  }

  registerPlugin(plugin: PluginInfo): void {
    this.plugins.set(plugin.name, plugin);
  }
}
