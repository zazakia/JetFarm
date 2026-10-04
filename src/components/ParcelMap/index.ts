// Platform-selecting barrel: Metro resolves ./ParcelMap to ParcelMap.web.tsx on
// web and ParcelMap.tsx on native. The barrel also keeps `./ParcelMap` typeable
// for tsc, which cannot see Metro's platform extensions.
export { default, ParcelMap } from './ParcelMap';
export * from './types';
