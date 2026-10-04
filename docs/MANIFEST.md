# Project Manifest - Cycle 1 (FROZEN)

**Status**: APPROVED & FROZEN
**Approval Timestamp**: 2026-10-02T01:45:00+08:00
**Cycle**: 1 (Features 001 - 003)

---

## FEATURE-001: GPS Boundary Walk & Polygon Coordinate Canonicalization
- **Purpose**: Field officers capture GPS boundary waypoints for farm parcels with real-time area calculation.
- **Acceptance Criteria**:
  - `AC-1.1`: GIVEN a field officer walking a parcel boundary with >= 3 GPS points, WHEN they finish the walk, THEN polygon area in hectares is computed accurately using geodesic/spherical shoelace formula.
  - `AC-1.2`: GIVEN parcel coordinates, WHEN saved to WatermelonDB, THEN they are persisted as canonical valid JSON string or NULL (never stringified empty array `"[]"`).
  - `AC-1.3`: GIVEN fewer than 3 coordinates, WHEN computing area, THEN it returns 0 hectares without throwing exceptions.
- **Dependencies**: AgriParcelService, WatermelonDB `agri_parcels` table.
- **Data/Migration Impact**: None (schema v48 has `coordinates` column).
- **Security/Permissions**: Field Officer / Admin role required.
- **Out of Scope**: Drone raster overlay, external GPS dongle bluetooth streaming.
- **Estimate**: 0.5 day.

---

## FEATURE-002: Parcel Boundary Map UI & Dark-Mode Safe Inspection
- **Purpose**: Interactive map screen displaying parcel boundaries, centroids, and area metrics with high contrast.
- **Acceptance Criteria**:
  - `AC-2.1`: GIVEN an active parcel with boundary coordinates, WHEN viewed on `/agribusiness/mapping`, THEN the polygon renders correctly without arbitrary hex Tailwind classes (standard Tailwind classes only).
  - `AC-2.2`: GIVEN no GPS coordinates, WHEN viewed, THEN an empty state prompt to start GPS walk is displayed.
  - `AC-2.3`: GIVEN any text inputs on the mapping screen, THEN explicit `placeholderTextColor` and text contrast classes are present to prevent dark mode white-on-white text bugs.
- **Dependencies**: FEATURE-001, `ParcelMap` component.
- **Data/Migration Impact**: None.
- **Security/Permissions**: Authenticated user with agribusiness permissions.
- **Out of Scope**: Third-party proprietary tile server licenses.
- **Estimate**: 0.5 day.

---

## FEATURE-003: Sales Return Multi-Item Restock & UOM Conversion
- **Purpose**: Handle customer return items: restock good items to warehouse shelf, convert pack/box to base UOM, and record stock movement.
- **Acceptance Criteria**:
  - `AC-3.1`: GIVEN a customer sales return with "good" condition items, WHEN approved and completed, THEN stock count increases by the converted base UOM quantity and a Stock Movement record is logged.
  - `AC-3.2`: GIVEN a return with "damaged" or "expired" items, WHEN completed, THEN items are flagged as non-sellable and NOT restocked to sellable inventory shelves.
  - `AC-3.3`: GIVEN multi-unit packs (e.g., box of 12), WHEN returned, THEN the restocked inventory count is converted to single units (Base UOM) correctly.
- **Dependencies**: SalesReturnService, InventoryService, StockMovementService.
- **Data/Migration Impact**: None (uses existing sales_returns and stock_movements tables).
- **Security/Permissions**: Supervisor / Admin approval required.
- **Out of Scope**: Supplier RMA return shipments.
- **Estimate**: 1 day.
