import type { PluginFactory } from '../types';

const registry = new Map<string, PluginFactory>();

/** Register a named plugin factory, making it available to every instance. */
export function registerPlugin(name: string, factory: PluginFactory): void {
    registry.set(name, factory);
}

/** Look up a registered plugin factory by name (undefined if not registered). */
export function getPlugin(name: string): PluginFactory | undefined {
    return registry.get(name);
}
