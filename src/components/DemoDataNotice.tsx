import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface Props {
    /** Module name as the operator knows it, e.g. "Agri-Store". */
    moduleName: string;
    /**
     * Set when the page shows monetary or count KPIs built from sample data. It adds the
     * accounting-specific warning, because a peso figure inside a finance app is read as a
     * booked figure whether or not the screen intended to imply that.
     */
    whatShowsNumbers?: boolean;
}

/**
 * Shown on a console that has no persistence layer yet.
 *
 * Agri-Store, Pharmacy and Transport keep their products/medicines/vehicles in `useState`, so
 * nothing they display is stored, synced, or posted to the ledger. See
 * docs/CRUD-PERSISTENCE-AUDIT.md M3/M4 and src/modules/__tests__/modulePersistenceGuards.test.ts
 * for the guards that keep this component and the shipped-dark defaults in place.
 */
export function DemoDataNotice({ moduleName, whatShowsNumbers = false }: Props) {
    return (
        <View
            testID="demo-notice"
            accessibilityRole="summary"
            className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-4"
        >
            <View className="flex-row items-start">
                <MaterialIcons name="engineering" size={20} color="#B45309" className="mr-2 mt-0.5" />
                <View className="flex-1">
                    <Text className="text-amber-900 text-sm font-bold">
                        {moduleName} is a preview console — sample data only.
                    </Text>
                    <Text className="text-amber-800 text-xs mt-1">
                        Nothing is saved to the database. Stock, sales and totals reset on reload,
                        and no record here reaches the sync engine.
                    </Text>
                    {whatShowsNumbers && (
                        <Text className="text-amber-800 text-xs mt-2 font-semibold">
                            The figures on this page are sample data, not bookkeeping entries. They do
                            not post to the ledger and must not be reported as revenue.
                        </Text>
                    )}
                </View>
            </View>
        </View>
    );
}

export default DemoDataNotice;
