import { ModuleRegistry } from './core/ModuleRegistry';
import { WaterStationModule } from './water-station/manifest';
import { AgriStoreModule } from './agri-store/manifest';
import { PharmacyModule } from './pharmacy/manifest';
import { TransportModule } from './transport/manifest';

ModuleRegistry.register(WaterStationModule);
ModuleRegistry.register(AgriStoreModule);
ModuleRegistry.register(PharmacyModule);
ModuleRegistry.register(TransportModule);

export { ModuleRegistry };
export default ModuleRegistry;
