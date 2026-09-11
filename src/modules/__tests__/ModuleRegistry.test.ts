import { ModuleRegistry } from '../registry';
import { ModuleRegistryClass } from '../core/ModuleRegistry';
import { WaterStationModule } from '../water-station/manifest';
import { AgriStoreModule } from '../agri-store/manifest';
import { PharmacyModule } from '../pharmacy/manifest';
import { TransportModule } from '../transport/manifest';

describe('ModuleRegistry', () => {
    it('registers default coop modules properly in global ModuleRegistry', () => {
        const modules = ModuleRegistry.getAll();
        expect(modules.length).toBeGreaterThanOrEqual(4);

        const ids = modules.map(m => m.id);
        expect(ids).toContain('water-station');
        expect(ids).toContain('agri-store');
        expect(ids).toContain('pharmacy');
        expect(ids).toContain('transport');
    });

    it('retrieves individual registered module by ID', () => {
        const ws = ModuleRegistry.get('water-station');
        expect(ws).toBeDefined();
        expect(ws?.name).toBe('Water Station');

        const agri = ModuleRegistry.get('agri-store');
        expect(agri).toBeDefined();
        expect(agri?.name).toBe('Agri-Store');

        const pharma = ModuleRegistry.get('pharmacy');
        expect(pharma).toBeDefined();
        expect(pharma?.name).toContain('Pharmacy');

        const transport = ModuleRegistry.get('transport');
        expect(transport).toBeDefined();
        expect(transport?.name).toContain('Transport');
    });

    it('returns enabled modules according to feature flag map', async () => {
        const customRegistry = new ModuleRegistryClass();
        customRegistry.register(WaterStationModule);
        customRegistry.register(AgriStoreModule);
        customRegistry.register(PharmacyModule);

        const flags = {
            [WaterStationModule.featureKey]: true,
            [AgriStoreModule.featureKey]: false,
            // Pharmacy feature key omitted -> defaults to true
        };

        const enabled = await customRegistry.getEnabledModules(flags);
        const enabledIds = enabled.map(m => m.id);

        expect(enabledIds).toContain('water-station');
        expect(enabledIds).toContain('pharmacy');
        expect(enabledIds).not.toContain('agri-store');
    });

    it('validates manifests structure across all modules', () => {
        const allModules = [WaterStationModule, AgriStoreModule, PharmacyModule, TransportModule];

        for (const mod of allModules) {
            expect(mod.id).toBeTruthy();
            expect(mod.name).toBeTruthy();
            expect(mod.version).toBe('1.0.0');
            expect(mod.featureKey).toMatch(/^feature\.modules\./);
            expect(mod.coaSegmentCode).toBeTruthy();
            expect(Array.isArray(mod.defaultCoA)).toBe(true);
            expect(mod.defaultCoA.length).toBeGreaterThan(0);
            expect(Array.isArray(mod.dbTables)).toBe(true);
            expect(Array.isArray(mod.routes)).toBe(true);
            expect(Array.isArray(mod.roles)).toBe(true);
        }
    });

    it('warns when overwriting an already registered module', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const registry = new ModuleRegistryClass();
        registry.register(WaterStationModule);
        registry.register(WaterStationModule);

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Module with ID water-station is already registered')
        );
        consoleSpy.mockRestore();
    });
});
