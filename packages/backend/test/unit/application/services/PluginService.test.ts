import { describe, it, expect } from 'vitest';
import { PluginService } from '../../../../src/application/services/PluginService.js';

describe('PluginService', () => {
  const service = new PluginService();

  it('should register plugin', () => {
    const plugin = {
      name: 'test-plugin',
      type: 'reader' as const,
      version: '1.0.0',
      path: '/path/to/plugin'
    };
    service.registerPlugin(plugin);
    const plugins = service.getAvailablePlugins();
    expect(plugins.length).toBe(1);
    expect(plugins[0].name).toBe('test-plugin');
  });

  it('should get available plugins', () => {
    const plugins = service.getAvailablePlugins();
    expect(Array.isArray(plugins)).toBe(true);
  });

  it('should apply plugins', async () => {
    const data = { test: 'data' };
    const result = await service.applyPlugins(data, 'reader');
    expect(result).toBeDefined();
  });
});
