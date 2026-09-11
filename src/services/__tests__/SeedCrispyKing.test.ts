import {
    CRISPY_KING_SUPERVISORS,
    CRISPY_KING_BRANCHES,
    CRISPY_KING_PRODUCTS,
    CRISPY_KING_SUPPLIERS,
    CRISPY_KING_COA,
    seedCrispyKingLocal,
} from '../../../scripts/seed-crispy-king';
import { createTestDatabase } from '../../__tests__/test-utils';

describe('Crispy King Master Seed Script', () => {
    it('defines exactly 4 supervisors and 39 branches', () => {
        expect(CRISPY_KING_SUPERVISORS).toHaveLength(4);

        const babyAnn = CRISPY_KING_SUPERVISORS.find((s) => s.code === 'AREA-BABYANN');
        const christian = CRISPY_KING_SUPERVISORS.find((s) => s.code === 'AREA-CHRISTIAN');
        const renor = CRISPY_KING_SUPERVISORS.find((s) => s.code === 'AREA-RENOR');
        const jumar = CRISPY_KING_SUPERVISORS.find((s) => s.code === 'AREA-JUMAR');

        expect(babyAnn).toBeDefined();
        expect(christian).toBeDefined();
        expect(renor).toBeDefined();
        expect(jumar).toBeDefined();

        expect(CRISPY_KING_BRANCHES).toHaveLength(39);

        const babyAnnBranches = CRISPY_KING_BRANCHES.filter((b) => b.supervisorCode === 'AREA-BABYANN');
        const christianBranches = CRISPY_KING_BRANCHES.filter((b) => b.supervisorCode === 'AREA-CHRISTIAN');
        const renorBranches = CRISPY_KING_BRANCHES.filter((b) => b.supervisorCode === 'AREA-RENOR');
        const jumarBranches = CRISPY_KING_BRANCHES.filter((b) => b.supervisorCode === 'AREA-JUMAR');

        expect(babyAnnBranches).toHaveLength(8);
        expect(christianBranches).toHaveLength(7);
        expect(renorBranches).toHaveLength(8);
        expect(jumarBranches).toHaveLength(16);

        // Verify key branches exist
        expect(CRISPY_KING_BRANCHES.some((b) => b.slug === 'ck-bagacay')).toBe(true);
        expect(CRISPY_KING_BRANCHES.some((b) => b.slug === 'ck-tayasan')).toBe(true);
        expect(CRISPY_KING_BRANCHES.some((b) => b.slug === 'ck-bayawan')).toBe(true);
        expect(CRISPY_KING_BRANCHES.some((b) => b.slug === 'ck-sagay-1')).toBe(true);
    });

    it('defines 10 QSR menu products with exact prices', () => {
        expect(CRISPY_KING_PRODUCTS.length).toBeGreaterThanOrEqual(10);

        const scut = CRISPY_KING_PRODUCTS.find((p) => p.sku === 'CK-SCUT');
        const rice = CRISPY_KING_PRODUCTS.find((p) => p.sku === 'CK-RICE');
        const neck = CRISPY_KING_PRODUCTS.find((p) => p.sku === 'CK-NECK');
        const fillet = CRISPY_KING_PRODUCTS.find((p) => p.sku === 'CK-FLT');
        const softdrinks1L = CRISPY_KING_PRODUCTS.find((p) => p.sku === 'CK-SD10');
        const softdrinks15L = CRISPY_KING_PRODUCTS.find((p) => p.sku === 'CK-SD15');

        expect(scut?.price).toBe(50.0);
        expect(rice?.price).toBe(15.0);
        expect(neck?.price).toBe(20.0);
        expect(fillet?.price).toBe(45.0);
        expect(softdrinks1L?.price).toBe(45.0);
        expect(softdrinks15L?.price).toBe(65.0);
    });

    it('defines 3 master suppliers (Magnolia, Bounty Fresh, Ali Agri)', () => {
        expect(CRISPY_KING_SUPPLIERS).toHaveLength(3);
        const supplierNames = CRISPY_KING_SUPPLIERS.map((s) => s.name);
        expect(supplierNames).toContain('Magnolia Chicken');
        expect(supplierNames).toContain('Bounty Fresh');
        expect(supplierNames).toContain('Ali Agri (Live/Dressed Broilers)');
    });

    it('defines standard QSR Chart of Accounts with assets, liabilities, equity, revenue, COGS, and OPEX', () => {
        const codes = CRISPY_KING_COA.map((a) => a.code);
        expect(codes).toContain('1010'); // Cash on Hand
        expect(codes).toContain('1200'); // Merchandise Inventory
        expect(codes).toContain('2010'); // AP Suppliers
        expect(codes).toContain('2050'); // Royalty Payable
        expect(codes).toContain('3010'); // Partner Capital
        expect(codes).toContain('4010'); // Fried Chicken Sales
        expect(codes).toContain('5010'); // Dressed Chicken Used
        expect(codes).toContain('5100'); // Spoilage & Bad Orders
        expect(codes).toContain('6010'); // Crew Salaries
    });

    it('seeds data into test WatermelonDB cleanly without throwing', async () => {
        const db = createTestDatabase();

        const result = await seedCrispyKingLocal(db);
        expect(result.branchesCreated).toBe(39);
        expect(result.supervisorsCreated).toBe(4);
        expect(result.productsCreated).toBe(CRISPY_KING_PRODUCTS.length);
        expect(result.suppliersCreated).toBe(3);
        expect(result.accountsCreated).toBe(CRISPY_KING_COA.length);

        // Idempotency: second run creates 0 duplicates
        const secondRun = await seedCrispyKingLocal(db);
        expect(secondRun.branchesCreated).toBe(0);
        expect(secondRun.productsCreated).toBe(0);
    });
});
