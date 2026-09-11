import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to parse CLI arguments
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
        const key = args[i].slice(2);
        const val = args[i + 1];
        options[key] = val;
        i++;
    }
}

const name = options.name || 'Pharmacy';
const slug = options.slug || 'pharmacy';
const coaCode = options.coaCode || 'PH';
const pascalName = name.replace(/\s+/g, '');
const camelName = pascalName.charAt(0).toLowerCase() + pascalName.slice(1);

console.log(`🚀 Scaffolding Cooperative Module: ${name} (${slug})`);

// 1. Create directory structures
const modulePath = path.join(rootDir, 'src', 'modules', slug);
const screensPath = path.join(rootDir, 'app', '(admin)', 'modules', slug);

fs.mkdirSync(path.join(modulePath, 'services'), { recursive: true });
fs.mkdirSync(screensPath, { recursive: true });

console.log(`📁 Directories created: \n - ${modulePath}\n - ${screensPath}`);

// 2. Generate Manifest file
const manifestContent = `import { CoopModule } from '../core/BaseModule';

export const ${pascalName}Module: CoopModule = {
    id: '${slug}',
    name: '${name}',
    icon: 'business',
    description: 'Track ${name} business operations, transactions, and segment ledger reports.',
    version: '1.0.0',
    featureKey: 'feature.modules.${slug}.enabled',
    coaSegmentCode: '${coaCode}',
    defaultCoA: [
        {
            code: '1017',
            name: 'Cash on Hand — ${name}',
            accountType: 'asset',
            normalBalance: 'debit',
            parentCode: '1000',
            sortOrder: 7
        },
        {
            code: '4200',
            name: '${name} Sales Revenue',
            accountType: 'income',
            normalBalance: 'credit',
            parentCode: '4000',
            sortOrder: 315
        }
    ],
    dbTables: [
        {
            name: '${slug}_transactions',
            columns: [
                { name: 'amount', type: 'number' },
                { name: 'details', type: 'string', isOptional: true }
            ]
        }
    ],
    routes: [
        {
            path: '/(admin)/modules/${slug}',
            label: 'Dashboard',
            icon: 'dashboard',
            permissionKey: 'permission.modules.${slug}.dashboard'
        }
    ],
    roles: [
        {
            role: '${slug}-staff',
            label: '${name} Staff',
            permissions: [
                'permission.modules.${slug}.dashboard'
            ]
        }
    ]
};

export default ${pascalName}Module;
`;

fs.writeFileSync(path.join(modulePath, 'manifest.ts'), manifestContent);
console.log(`📝 Manifest generated at: ${path.join(modulePath, 'manifest.ts')}`);

// 3. Generate Service Template
const serviceContent = `import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../../../src/database';
import ActionLogService from '../../../src/services/ActionLogService';
import { ModuleAccountingBridge } from '../../core/ModuleAccountingBridge';
import ${pascalName}Module from '../manifest';

export class ${pascalName}ServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    async recordSale(amount: number, details: string, performedBy?: string) {
        // Post Segment double-entry entry
        // Debit: Cash, Credit: Revenue
        await ModuleAccountingBridge.postModuleEntry(
            ${pascalName}Module,
            {
                entryDate: new Date(),
                description: \`Sale - \${details}\`,
                entryType: 'auto',
                lines: [
                    {
                        accountCode: '1017',
                        accountName: 'Cash on Hand — ${name}',
                        debitAmount: amount
                    },
                    {
                        accountCode: '4200',
                        accountName: '${name} Sales Revenue',
                        creditAmount: amount
                    }
                ],
                postedBy: performedBy
            },
            performedBy
        );
    }
}

export const ${pascalName}Service = new ${pascalName}ServiceClass();
export default ${pascalName}Service;
`;

fs.writeFileSync(path.join(modulePath, 'services', `${pascalName}Service.ts`), serviceContent);
console.log(`📝 Service generated at: ${path.join(modulePath, 'services', `${pascalName}Service.ts`)}`);

// 4. Generate Dashboard Screen Template
const screenContent = `import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ${pascalName}Service } from '../../../src/modules/${slug}/services/${pascalName}Service';
import { ConsolidationService } from '../../../src/services/ConsolidationService';

export default function ${pascalName}Dashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState(0);
    const [amount, setAmount] = useState('');
    const [details, setDetails] = useState('');

    const loadData = async () => {
        try {
            const balances = await ConsolidationService.getBalances(new Date(), '${slug}');
            setBalance(balances.get('1017') ?? 0);
        } catch (error) {
            console.error('Failed to load ${name} balances:', error);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const handleRecordSale = async () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            Alert.alert('Validation Error', 'Enter a valid amount.');
            return;
        }

        setLoading(true);
        try {
            await ${pascalName}Service.recordSale(val, details || 'Quick Sale');
            Alert.alert('Success', 'Sale recorded and Ledger entry posted.');
            setAmount('');
            setDetails('');
            await loadData();
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-gray-50 p-4">
            <View className="flex-row items-center mb-6">
                <Pressable onPress={() => router.push('/(admin)/modules')} className="mr-3 bg-white p-2 rounded-lg border border-gray-200">
                    <MaterialIcons name="arrow-back" size={20} color="#1E3A8A" />
                </Pressable>
                <View>
                    <Text className="text-xl font-bold text-gray-900">${name} Unit</Text>
                    <Text className="text-xs text-gray-500">Business Unit Console</Text>
                </View>
            </View>

            <View className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs mb-6">
                <Text className="text-xs font-semibold text-gray-400">WS SEGMENT BALANCE</Text>
                <Text className="text-3xl font-black text-gray-950 mt-1">₱{balance.toFixed(2)}</Text>
            </View>

            <View className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs">
                <Text className="text-base font-bold text-gray-900 mb-4">Record New Transaction</Text>
                <View className="space-y-4">
                    <View>
                        <Text className="text-xs font-bold text-gray-600 mb-1">Sale Amount (₱)</Text>
                        <TextInput
                            className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-gray-900"
                            placeholder="0.00"
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                        />
                    </View>
                    <View className="mt-3">
                        <Text className="text-xs font-bold text-gray-600 mb-1">Details / Items</Text>
                        <TextInput
                            className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-gray-900"
                            placeholder="e.g. Paracetamol, Vitamins"
                            value={details}
                            onChangeText={setDetails}
                        />
                    </View>

                    <Pressable
                        onPress={handleRecordSale}
                        disabled={loading}
                        className="bg-blue-900 py-3 rounded-lg mt-6 active:bg-blue-800 items-center justify-center flex-row"
                    >
                        {loading && <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />}
                        <Text className="text-white font-bold">Post Transaction</Text>
                    </Pressable>
                </View>
            </View>
        </ScrollView>
    );
}
`;

fs.writeFileSync(path.join(screensPath, 'index.tsx'), screenContent);
console.log(`📝 Screen generated at: ${path.join(screensPath, 'index.tsx')}`);

// 5. Inject Import into central registry.ts
const registryFile = path.join(rootDir, 'src', 'modules', 'registry.ts');
let registryContent = fs.readFileSync(registryFile, 'utf8');

const importStatement = `import { ${pascalName}Module } from './${slug}/manifest';`;
const registerStatement = `ModuleRegistry.register(${pascalName}Module);`;

if (!registryContent.includes(importStatement)) {
    // Insert import statement at top, and register statement before the exports
    const lines = registryContent.split('\n');
    lines.unshift(importStatement);

    const exportIndex = lines.findIndex(l => l.includes('export {'));
    if (exportIndex !== -1) {
        lines.splice(exportIndex, 0, registerStatement, '');
    } else {
        lines.push(registerStatement);
    }
    
    fs.writeFileSync(registryFile, lines.join('\n'));
    console.log(`🔗 Auto-registered in: ${registryFile}`);
} else {
    console.log(`ℹ️ Module is already registered in registry.ts`);
}

// 6. Generate Supabase SQL file template
const migrationName = `${Date.now()}_add_${slug}_module.sql`;
const sqlPath = path.join(rootDir, 'supabase', 'migrations', migrationName);
const sqlContent = `-- Migration: Add ${name} Module tables
-- Date: ${new Date().toISOString().split('T')[0]}

-- Define tables here
-- Example:
-- CREATE TABLE IF NOT EXISTS public.${slug}_transactions (
--     id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     amount              NUMERIC(12,2) NOT NULL,
--     details             TEXT,
--     created_at          TIMESTAMPTZ DEFAULT NOW(),
--     updated_at          TIMESTAMPTZ DEFAULT NOW(),
--     deleted_at          TIMESTAMPTZ
-- );
`;

fs.writeFileSync(sqlPath, sqlContent);
console.log(`📝 Supabase migration template generated at: ${sqlPath}`);
console.log(`🎉 Scaffolding completed successfully!`);
