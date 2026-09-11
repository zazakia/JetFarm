import { JournalEntryServiceClass } from '../../services/JournalEntryService';
import { database as globalDatabase } from '../../database';
import { CoopModule } from './BaseModule';

export class ModuleAccountingBridgeClass {
    private journalEntryService: JournalEntryServiceClass;

    constructor(db = globalDatabase) {
        this.journalEntryService = new JournalEntryServiceClass(db);
    }

    /**
     * Creates a journal entry tagged to a specific business unit module
     */
    async postModuleEntry(
        module: CoopModule,
        input: {
            entryDate: Date;
            description: string;
            entryType: 'auto' | 'manual' | 'adjusting' | 'closing';
            lines: {
                accountCode: string;
                accountName?: string;
                debitAmount?: number;
                creditAmount?: number;
                description?: string;
            }[];
            sourceTable?: string;
            sourceId?: string;
            postedBy?: string;
        },
        performedBy?: string
    ) {
        // Map the lines to include the module's businessUnitId
        const linesWithBU = input.lines.map(line => ({
            ...line,
            businessUnitId: module.id || null,
            moduleSourceTable: input.sourceTable,
            moduleSourceId: input.sourceId
        }));

        return await this.journalEntryService.createEntry(
            {
                entryDate: input.entryDate,
                description: `[${module.name}] ${input.description}`,
                entryType: input.entryType,
                lines: linesWithBU,
                sourceTable: input.sourceTable,
                sourceId: input.sourceId,
                postedBy: input.postedBy
            },
            performedBy
        );
    }
}

export const ModuleAccountingBridge = new ModuleAccountingBridgeClass();
export default ModuleAccountingBridge;
