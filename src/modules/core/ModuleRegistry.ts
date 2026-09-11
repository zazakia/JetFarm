import { CoopModule } from './BaseModule';

export class ModuleRegistryClass {
    private modules = new Map<string, CoopModule>();

    register(module: CoopModule) {
        if (this.modules.has(module.id)) {
            console.warn(`Module with ID ${module.id} is already registered. Overwriting.`);
        }
        this.modules.set(module.id, module);
    }

    get(id: string): CoopModule | undefined {
        return this.modules.get(id);
    }

    getAll(): CoopModule[] {
        return Array.from(this.modules.values());
    }

    // Helper to get active modules based on feature flag values
    async getEnabledModules(featureFlagMap: Record<string, boolean>): Promise<CoopModule[]> {
        return this.getAll().filter(module => {
            // Default to true if feature key is not set, or check featureFlagMap
            const key = module.featureKey;
            return featureFlagMap[key] !== false;
        });
    }
}

export const ModuleRegistry = new ModuleRegistryClass();
export default ModuleRegistry;
