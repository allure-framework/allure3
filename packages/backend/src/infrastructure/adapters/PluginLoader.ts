import { PluginService } from '../../application/services/PluginService.js';
import type { PluginInfo } from '../../application/services/PluginService.js';
import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';

export interface Plugin {
  name: string;
  type: 'reader' | 'aggregator' | 'extension';
  version: string;
  path: string;
  module?: any;
  initialized: boolean;
}

export interface PluginConfig {
  [key: string]: any;
}

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private pluginService: PluginService;

  constructor(pluginService: PluginService) {
    this.pluginService = pluginService;
  }

  async loadPlugin(pluginPath: string): Promise<Plugin> {
    try {
      // Dynamic import of plugin module
      const pluginModule = await import(pluginPath);
      
      // Extract plugin metadata
      const pluginInfo = pluginModule.default || pluginModule;
      
      if (!pluginInfo.name || !pluginInfo.type || !pluginInfo.version) {
        throw new Error(`Invalid plugin format: ${pluginPath}`);
      }

      const plugin: Plugin = {
        name: pluginInfo.name,
        type: pluginInfo.type,
        version: pluginInfo.version,
        path: pluginPath,
        module: pluginModule,
        initialized: false
      };

      this.plugins.set(plugin.name, plugin);
      this.pluginService.registerPlugin({
        name: plugin.name,
        type: plugin.type,
        version: plugin.version,
        path: plugin.path
      });

      return plugin;
    } catch (error) {
      throw new Error(`Failed to load plugin from ${pluginPath}: ${error}`);
    }
  }

  async loadPlugins(pluginPaths: string[]): Promise<Plugin[]> {
    const loadedPlugins: Plugin[] = [];
    
    for (const path of pluginPaths) {
      try {
        const plugin = await this.loadPlugin(path);
        loadedPlugins.push(plugin);
      } catch (error) {
        console.error(`Failed to load plugin from ${path}:`, error);
        // Continue loading other plugins
      }
    }

    return loadedPlugins;
  }

  async discoverPlugins(pluginDirectory: string): Promise<string[]> {
    try {
      const entries = await readdir(pluginDirectory);
      const pluginPaths: string[] = [];

      for (const entry of entries) {
        const fullPath = join(pluginDirectory, entry);
        const stats = await stat(fullPath);

        if (stats.isFile() && (extname(entry) === '.js' || extname(entry) === '.ts')) {
          pluginPaths.push(fullPath);
        } else if (stats.isDirectory()) {
          // Recursively search in subdirectories
          const subPlugins = await this.discoverPlugins(fullPath);
          pluginPaths.push(...subPlugins);
        }
      }

      return pluginPaths;
    } catch (error) {
      console.error(`Failed to discover plugins in ${pluginDirectory}:`, error);
      return [];
    }
  }

  async initializePlugin(plugin: Plugin, config: PluginConfig = {}): Promise<void> {
    if (plugin.initialized) {
      return;
    }

    try {
      // Call plugin initialization if available
      if (plugin.module && typeof plugin.module.initialize === 'function') {
        await plugin.module.initialize(config);
      }

      plugin.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize plugin ${plugin.name}: ${error}`);
    }
  }

  async unloadPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return;
    }

    // Call plugin cleanup if available
    if (plugin.module && typeof plugin.module.cleanup === 'function') {
      await plugin.module.cleanup();
    }

    this.plugins.delete(pluginName);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginsByType(type: 'reader' | 'aggregator' | 'extension'): Plugin[] {
    return Array.from(this.plugins.values()).filter((plugin) => plugin.type === type);
  }
}
