/**
 * Crispy King Master Seed Script
 *
 * Seeds master data for Crispy King / Viterbo Foods OPC:
 * - 4 Area Supervisors & 39 Franchise Branches
 * - 10 Standard QSR Products + 2 Wholesale By-Products
 * - 3 Primary Broiler & Commissary Suppliers
 * - Standard QSR Chart of Accounts (CDA/BIR compliant)
 */

export interface SeedAreaSupervisor {
    code: string;
    name: string;
    fullName: string;
    email: string;
    storeCount: number;
}

export interface SeedBranch {
    slug: string;
    name: string;
    supervisorCode: string;
    description: string;
}

export interface SeedProduct {
    sku: string;
    title: string;
    price: number;
    category: string;
    stockQuantity: number;
    description: string;
}

export interface SeedSupplier {
    name: string;
    contactPerson: string;
    phone: string;
    tin: string;
    paymentTermsDays: number;
    address: string;
}

export interface SeedAccount {
    code: string;
    name: string;
    accountType: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    normalBalance: 'debit' | 'credit';
    isHeader?: boolean;
    parentCode?: string;
    description?: string;
    sortOrder?: number;
}

export const CRISPY_KING_SUPERVISORS: SeedAreaSupervisor[] = [
    {
        code: 'AREA-BABYANN',
        name: 'Area Baby Ann',
        fullName: 'Baby Ann',
        email: 'supervisor.babyann@crispyking.ph',
        storeCount: 8,
    },
    {
        code: 'AREA-CHRISTIAN',
        name: 'Area Christian',
        fullName: 'Christian',
        email: 'supervisor.christian@crispyking.ph',
        storeCount: 7,
    },
    {
        code: 'AREA-RENOR',
        name: 'Area Renor',
        fullName: 'Renor',
        email: 'supervisor.renor@crispyking.ph',
        storeCount: 8,
    },
    {
        code: 'AREA-JUMAR',
        name: 'Area Jumar',
        fullName: 'Jumar',
        email: 'supervisor.jumar@crispyking.ph',
        storeCount: 16,
    },
];

export const CRISPY_KING_BRANCHES: SeedBranch[] = [
    // ── Area Baby Ann (8 stores) ──────────────────────
    { slug: 'ck-tayasan', name: 'Crispy King - Tayasan', supervisorCode: 'AREA-BABYANN', description: 'Tayasan Franchise Branch' },
    { slug: 'ck-ayungon-1', name: 'Crispy King - Ayungon 1', supervisorCode: 'AREA-BABYANN', description: 'Ayungon Branch 1' },
    { slug: 'ck-ayungon-2', name: 'Crispy King - Ayungon 2', supervisorCode: 'AREA-BABYANN', description: 'Ayungon Branch 2' },
    { slug: 'ck-bindoy-1', name: 'Crispy King - Bindoy 1', supervisorCode: 'AREA-BABYANN', description: 'Bindoy Branch 1' },
    { slug: 'ck-bindoy-2', name: 'Crispy King - Bindoy 2', supervisorCode: 'AREA-BABYANN', description: 'Bindoy Branch 2' },
    { slug: 'ck-guihulngan', name: 'Crispy King - Guihulngan', supervisorCode: 'AREA-BABYANN', description: 'Guihulngan City Branch' },
    { slug: 'ck-jimalalud', name: 'Crispy King - Jimalalud', supervisorCode: 'AREA-BABYANN', description: 'Jimalalud Branch' },
    { slug: 'ck-manjuyod', name: 'Crispy King - Manjuyod', supervisorCode: 'AREA-BABYANN', description: 'Manjuyod Branch' },

    // ── Area Christian (7 stores) ─────────────────────
    { slug: 'ck-bayawan', name: 'Crispy King - Bayawan', supervisorCode: 'AREA-CHRISTIAN', description: 'Bayawan City Branch' },
    { slug: 'ck-mabinay-1', name: 'Crispy King - Mabinay 1', supervisorCode: 'AREA-CHRISTIAN', description: 'Mabinay Branch 1' },
    { slug: 'ck-mabinay-2', name: 'Crispy King - Mabinay 2', supervisorCode: 'AREA-CHRISTIAN', description: 'Mabinay Branch 2' },
    { slug: 'ck-pamplona', name: 'Crispy King - Pamplona', supervisorCode: 'AREA-CHRISTIAN', description: 'Pamplona Branch' },
    { slug: 'ck-sta-agueda', name: 'Crispy King - Sta. Agueda', supervisorCode: 'AREA-CHRISTIAN', description: 'Sta. Agueda Branch' },
    { slug: 'ck-tanjay-1', name: 'Crispy King - Tanjay 1', supervisorCode: 'AREA-CHRISTIAN', description: 'Tanjay City Branch 1' },
    { slug: 'ck-tanjay-2', name: 'Crispy King - Tanjay 2', supervisorCode: 'AREA-CHRISTIAN', description: 'Tanjay City Branch 2' },

    // ── Area Renor (8 stores) ─────────────────────────
    { slug: 'ck-sagay-1', name: 'Crispy King - Sagay 1', supervisorCode: 'AREA-RENOR', description: 'Sagay Branch 1' },
    { slug: 'ck-san-carlos-2', name: 'Crispy King - San Carlos 2', supervisorCode: 'AREA-RENOR', description: 'San Carlos City Branch 2' },
    { slug: 'ck-sagay-2', name: 'Crispy King - Sagay 2', supervisorCode: 'AREA-RENOR', description: 'Sagay Branch 2' },
    { slug: 'ck-san-carlos-1', name: 'Crispy King - San Carlos 1', supervisorCode: 'AREA-RENOR', description: 'San Carlos City Branch 1' },
    { slug: 'ck-quezon', name: 'Crispy King - Quezon', supervisorCode: 'AREA-RENOR', description: 'Quezon Branch' },
    { slug: 'ck-san-carlos-5', name: 'Crispy King - San Carlos 5', supervisorCode: 'AREA-RENOR', description: 'San Carlos City Branch 5' },
    { slug: 'ck-san-carlos-7', name: 'Crispy King - San Carlos 7', supervisorCode: 'AREA-RENOR', description: 'San Carlos City Branch 7' },
    { slug: 'ck-canla-on', name: 'Crispy King - Canla-on', supervisorCode: 'AREA-RENOR', description: 'Canlaon City Branch' },

    // ── Area Jumar (16 stores) ────────────────────────
    { slug: 'ck-locsin', name: 'Crispy King - Locsin', supervisorCode: 'AREA-JUMAR', description: 'Locsin Dumaguete Branch' },
    { slug: 'ck-noph', name: 'Crispy King - NOPH', supervisorCode: 'AREA-JUMAR', description: 'NOPH Dumaguete Branch' },
    { slug: 'ck-zambo', name: 'Crispy King - Zambo', supervisorCode: 'AREA-JUMAR', description: 'Zamboanguita Branch' },
    { slug: 'ck-daro', name: 'Crispy King - Daro', supervisorCode: 'AREA-JUMAR', description: 'Daro Dumaguete Branch' },
    { slug: 'ck-sta-rosa', name: 'Crispy King - Sta. Rosa', supervisorCode: 'AREA-JUMAR', description: 'Sta. Rosa Branch' },
    { slug: 'ck-dalaguete', name: 'Crispy King - Dalaguete', supervisorCode: 'AREA-JUMAR', description: 'Dalaguete Cebu Branch' },
    { slug: 'ck-bacong-1', name: 'Crispy King - Bacong 1', supervisorCode: 'AREA-JUMAR', description: 'Bacong Branch 1' },
    { slug: 'ck-batinguel', name: 'Crispy King - Batinguel', supervisorCode: 'AREA-JUMAR', description: 'Batinguel Dumaguete Branch' },
    { slug: 'ck-junob', name: 'Crispy King - Junob', supervisorCode: 'AREA-JUMAR', description: 'Junob Dumaguete Branch' },
    { slug: 'ck-bagacay', name: 'Crispy King - Bagacay', supervisorCode: 'AREA-JUMAR', description: 'Bagacay Benchmark Branch' },
    { slug: 'ck-larena', name: 'Crispy King - Larena', supervisorCode: 'AREA-JUMAR', description: 'Larena Siquijor Branch' },
    { slug: 'ck-bacong-2', name: 'Crispy King - Bacong 2', supervisorCode: 'AREA-JUMAR', description: 'Bacong Branch 2' },
    { slug: 'ck-lilo-an', name: 'Crispy King - Lilo-an', supervisorCode: 'AREA-JUMAR', description: 'Liloan Cebu Branch' },
    { slug: 'ck-tinago', name: 'Crispy King - Tinago', supervisorCode: 'AREA-JUMAR', description: 'Tinago Dumaguete Branch' },
    { slug: 'ck-santander', name: 'Crispy King - Santander', supervisorCode: 'AREA-JUMAR', description: 'Santander Cebu Branch' },
    { slug: 'ck-dumaguete-port', name: 'Crispy King - Dumaguete Port', supervisorCode: 'AREA-JUMAR', description: 'Dumaguete Port Terminal Branch' },
];

export const CRISPY_KING_PRODUCTS: SeedProduct[] = [
    { sku: 'CK-SCUT', title: 'Special Cut Fried Chicken', price: 50.0, category: 'chicken', stockQuantity: 500, description: 'Crispy deep-fried golden brown chicken piece with savory gravy' },
    { sku: 'CK-RICE', title: 'Cooked Rice', price: 15.0, category: 'sides', stockQuantity: 1000, description: 'Steamed fragrant white rice' },
    { sku: 'CK-SD10', title: 'Softdrinks 1.0L', price: 45.0, category: 'drinks', stockQuantity: 200, description: '1.0 Liter bottled soda' },
    { sku: 'CK-SD15', title: 'Softdrinks 1.5L', price: 65.0, category: 'drinks', stockQuantity: 150, description: '1.5 Liter bottled soda' },
    { sku: 'CK-NECK', title: 'Chicken Neck', price: 20.0, category: 'specialty', stockQuantity: 300, description: 'Crispy seasoned fried chicken neck piece' },
    { sku: 'CK-FLT', title: 'Chicken Fillet', price: 45.0, category: 'specialty', stockQuantity: 250, description: 'Boneless tender chicken fillet' },
    { sku: 'CK-BOLA', title: 'Bola-Bola', price: 20.0, category: 'specialty', stockQuantity: 400, description: 'Crispy chicken meatballs' },
    { sku: 'CK-LUMP', title: 'Lumpia', price: 15.0, category: 'specialty', stockQuantity: 400, description: 'Crispy fried spring roll' },
    { sku: 'CK-NGOH', title: 'Ngohiong', price: 20.0, category: 'specialty', stockQuantity: 350, description: 'Spiced deep fried five-spice roll' },
    { sku: 'CK-ATSR', title: 'Atsara', price: 10.0, category: 'condiments', stockQuantity: 300, description: 'Pickled sweet and sour papaya' },
    { sku: 'CK-FATS', title: 'Chicken Fats (Wholesale)', price: 50.0, category: 'by-product', stockQuantity: 100, description: 'Raw chicken fat by-product (per kg)' },
    { sku: 'CK-SKIN', title: 'Chicken Skin (Wholesale)', price: 80.0, category: 'by-product', stockQuantity: 100, description: 'Raw chicken skin by-product (per kg)' },
];

export const CRISPY_KING_SUPPLIERS: SeedSupplier[] = [
    {
        name: 'Magnolia Chicken',
        contactPerson: 'Account Representative',
        phone: '0917-111-0001',
        tin: '102-345-678-000',
        paymentTermsDays: 15,
        address: 'San Miguel Foods, Mandaue City, Cebu',
    },
    {
        name: 'Bounty Fresh',
        contactPerson: 'Wholesale Delivery Team',
        phone: '0917-111-0002',
        tin: '203-456-789-000',
        paymentTermsDays: 15,
        address: 'Bounty Fresh Food Inc., Bacolod City',
    },
    {
        name: 'Ali Agri (Live/Dressed Broilers)',
        contactPerson: 'Broiler Dispatch',
        phone: '0917-111-0003',
        tin: '304-567-890-000',
        paymentTermsDays: 7,
        address: 'Ali Agricultural Farm, Dumaguete City',
    },
];

export const CRISPY_KING_COA: SeedAccount[] = [
    // ── ASSETS (1000s) ────────────────────────────────
    { code: '1000', name: 'ASSETS', accountType: 'asset', normalBalance: 'debit', isHeader: true, sortOrder: 1 },
    { code: '1010', name: 'Cash on Hand (COH)', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 2 },
    { code: '1020', name: 'Petty Cash Fund', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 3 },
    { code: '1100', name: 'Accounts Receivable', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 10 },
    { code: '1200', name: 'Merchandise Inventory', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 15, description: 'Raw Chicken, Fried Chicken, Rice, Oil, Breading, Drinks' },

    // ── LIABILITIES (2000s) ───────────────────────────
    { code: '2000', name: 'LIABILITIES', accountType: 'liability', normalBalance: 'credit', isHeader: true, sortOrder: 100 },
    { code: '2010', name: 'Accounts Payable (Suppliers)', accountType: 'liability', normalBalance: 'credit', parentCode: '2000', sortOrder: 101 },
    { code: '2050', name: 'Due to Franchisor (Royalty Payable)', accountType: 'liability', normalBalance: 'credit', parentCode: '2000', sortOrder: 105 },

    // ── EQUITY (3000s) ────────────────────────────────
    { code: '3000', name: 'EQUITY', accountType: 'equity', normalBalance: 'credit', isHeader: true, sortOrder: 200 },
    { code: '3010', name: 'Partner Capital (Viterbo Foods OPC)', accountType: 'equity', normalBalance: 'credit', parentCode: '3000', sortOrder: 201 },

    // ── REVENUE (4000s) ───────────────────────────────
    { code: '4000', name: 'REVENUE', accountType: 'income', normalBalance: 'credit', isHeader: true, sortOrder: 300 },
    { code: '4010', name: 'Fried Chicken Sales', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 301 },
    { code: '4020', name: 'Rice Sales', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 302 },
    { code: '4030', name: 'Beverage Sales', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 303 },
    { code: '4040', name: 'Specialty Sales', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 304 },
    { code: '4050', name: 'By-Product Sales (Fats/Skin)', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 305 },

    // ── COGS (5000s) ──────────────────────────────────
    { code: '5000', name: 'COST OF GOODS SOLD', accountType: 'expense', normalBalance: 'debit', isHeader: true, sortOrder: 400 },
    { code: '5010', name: 'Dressed Chicken Used', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 401 },
    { code: '5020', name: 'Deep Frying Oil', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 402 },
    { code: '5030', name: 'Breading & Gravy Mix', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 403 },
    { code: '5040', name: 'Raw Rice', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 404 },
    { code: '5050', name: 'Beverage Inventory Used', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 405 },

    // ── OPEX (6000s & Spoilage) ───────────────────────
    { code: '5100', name: 'Spoilage & Bad Orders', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 410 },
    { code: '6000', name: 'OPERATING EXPENSES', accountType: 'expense', normalBalance: 'debit', isHeader: true, sortOrder: 500 },
    { code: '6010', name: 'Crew Salaries & Wages', accountType: 'expense', normalBalance: 'debit', parentCode: '6000', sortOrder: 501 },
    { code: '6020', name: 'Store Rent', accountType: 'expense', normalBalance: 'debit', parentCode: '6000', sortOrder: 502 },
    { code: '6030', name: 'LPG Cooking Gas', accountType: 'expense', normalBalance: 'debit', parentCode: '6000', sortOrder: 503 },
    { code: '6040', name: 'Electricity', accountType: 'expense', normalBalance: 'debit', parentCode: '6000', sortOrder: 504 },
    { code: '6050', name: 'Tap Water', accountType: 'expense', normalBalance: 'debit', parentCode: '6000', sortOrder: 505 },
    { code: '6060', name: 'Packaging & Paper Bags', accountType: 'expense', normalBalance: 'debit', parentCode: '6000', sortOrder: 506 },
    { code: '6070', name: 'Local Taxes & BIR', accountType: 'expense', normalBalance: 'debit', parentCode: '6000', sortOrder: 507 },
    { code: '6080', name: 'Team Leader Allowance', accountType: 'expense', normalBalance: 'debit', parentCode: '6000', sortOrder: 508 },
    { code: '6090', name: 'Repair & Maintenance', accountType: 'expense', normalBalance: 'debit', parentCode: '6000', sortOrder: 509 },
];

/**
 * Seeds Crispy King master data into local WatermelonDB
 */
export async function seedCrispyKingLocal(db: any): Promise<{
    supervisorsCreated: number;
    branchesCreated: number;
    productsCreated: number;
    suppliersCreated: number;
    accountsCreated: number;
}> {
    const getCol = (name: string) => {
        try {
            return db.get(name);
        } catch {
            return null;
        }
    };

    return await db.write(async () => {
        let supervisorsCreated = 0;
        let branchesCreated = 0;
        let productsCreated = 0;
        let suppliersCreated = 0;
        let accountsCreated = 0;

        // 1. Seed Area Supervisors in UserProfiles & Areas
        const areaMap = new Map<string, string>(); // code -> areaId
        const supervisorMap = new Map<string, string>(); // code -> supervisorUserId

        const areaCol = getCol('areas');
        if (areaCol) {
            for (const s of CRISPY_KING_SUPERVISORS) {
                const existing = await areaCol.query().fetch();
                let area = existing.find((a: any) => a.code === s.code);
                if (!area) {
                    area = await areaCol.create((a: any) => {
                        a.name = s.name;
                        a.code = s.code;
                        a.isActive = true;
                    });
                }
                areaMap.set(s.code, area.id);
            }
        }

        const userCol = getCol('user_profiles');
        if (userCol) {
            for (const s of CRISPY_KING_SUPERVISORS) {
                const existing = await userCol.query().fetch();
                let user = existing.find((u: any) => u.email === s.email);
                if (!user) {
                    user = await userCol.create((u: any) => {
                        u.fullName = s.fullName;
                        u.email = s.email;
                        u.role = 'area_supervisor';
                        u.isActive = true;
                        u.areaId = areaMap.get(s.code) || null;
                    });
                    supervisorsCreated++;
                }
                supervisorMap.set(s.code, user.id);
            }
        }

        // 2. Seed 39 Branches (BusinessUnits)
        const buCol = getCol('business_units');
        if (buCol) {
            const existingBUs = await buCol.query().fetch();
            const existingSlugMap = new Map(existingBUs.map((b: any) => [b.slug, b]));

            for (const b of CRISPY_KING_BRANCHES) {
                if (!existingSlugMap.has(b.slug)) {
                    await buCol.create((bu: any) => {
                        bu.name = b.name;
                        bu.slug = b.slug;
                        bu.moduleId = 'crispy-king';
                        bu.isActive = true;
                        bu.description = b.description;
                        bu.areaId = areaMap.get(b.supervisorCode) || null;
                        bu.areaSupervisorId = supervisorMap.get(b.supervisorCode) || null;
                    });
                    branchesCreated++;
                }
            }
        }

        // 3. Seed Master Products
        const prodCol = getCol('marketplace_products');
        if (prodCol) {
            const existingProds = await prodCol.query().fetch();
            const existingSkuMap = new Map(existingProds.map((p: any) => [p.sku, p]));

            for (const p of CRISPY_KING_PRODUCTS) {
                if (!existingSkuMap.has(p.sku)) {
                    await prodCol.create((prod: any) => {
                        prod.storeId = 'ck-main-commissary';
                        prod.title = p.title;
                        prod.sku = p.sku;
                        prod.price = p.price;
                        prod.productType = p.category;
                        prod.stockQuantity = p.stockQuantity;
                        prod.status = 'active';
                        prod.description = p.description;
                    });
                    productsCreated++;
                }
            }
        }

        // 4. Seed Suppliers
        const supCol = getCol('suppliers');
        if (supCol) {
            const existingSups = await supCol.query().fetch();
            const existingNameMap = new Map(existingSups.map((s: any) => [s.name, s]));

            for (const s of CRISPY_KING_SUPPLIERS) {
                if (!existingNameMap.has(s.name)) {
                    await supCol.create((sup: any) => {
                        sup.name = s.name;
                        sup.contactPerson = s.contactPerson;
                        sup.phone = s.phone;
                        sup.tin = s.tin;
                        sup.paymentTermsDays = s.paymentTermsDays;
                        sup.address = s.address;
                        sup.isActive = true;
                    });
                    suppliersCreated++;
                }
            }
        }

        // 5. Seed Chart of Accounts
        const coaCol = getCol('chart_of_accounts');
        if (coaCol) {
            const existingAccounts = await coaCol.query().fetch();
            const existingCodeMap = new Map(existingAccounts.map((a: any) => [a.code, a]));

            for (const a of CRISPY_KING_COA) {
                if (!existingCodeMap.has(a.code)) {
                    await coaCol.create((acc: any) => {
                        acc.code = a.code;
                        acc.name = a.name;
                        acc.accountType = a.accountType;
                        acc.normalBalance = a.normalBalance;
                        acc.isHeader = a.isHeader || false;
                        acc.parentCode = a.parentCode || null;
                        acc.description = a.description || null;
                        acc.sortOrder = a.sortOrder || null;
                        acc.isActive = true;
                    });
                    accountsCreated++;
                }
            }
        }

        return {
            supervisorsCreated,
            branchesCreated,
            productsCreated,
            suppliersCreated,
            accountsCreated,
        };
    });
}
