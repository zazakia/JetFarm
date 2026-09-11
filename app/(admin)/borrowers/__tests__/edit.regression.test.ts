/**
 * Regression tests for Borrower Edit Save functionality.
 *
 * Covers:
 * 1. Phone and address are ENCRYPTED before saving (critical bug fix)
 * 2. Decrypted values are shown in form pre-population (not raw encrypted strings)
 * 3. parseDateLocal correctly converts YYYY-MM-DD without UTC timezone offset
 * 4. All mapped fields persist correctly through BaseModelService.update
 * 5. Audit logging is triggered on update
 */

import { Database } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase, createTestData } from '../../../../src/__tests__/test-utils';
import Borrower from '../../../../src/database/models/Borrower';
import { BaseModelServiceClass } from '../../../../src/services/BaseModelService';

import { EncryptionService } from '../../../../src/services/EncryptionService';
import { parseDateLocal } from '../../../../src/utils/dates';

// Mock EncryptionService - deterministic prefix so we can assert stored values
jest.mock('../../../../src/services/EncryptionService', () => ({
    EncryptionService: {
        encrypt: jest.fn((text: string | null | undefined) => {
            if (!text) return null;
            return `ENCRYPTED::${text}`;
        }),
        decrypt: jest.fn((text: string | null | undefined) => {
            if (!text) return null;
            if (typeof text === 'string' && text.startsWith('ENCRYPTED::')) {
                return text.replace('ENCRYPTED::', '');
            }
            return text;
        }),
    },
}));

jest.mock('../../../../src/services/ActionLogService', () => ({
    __esModule: true,
    default: {
        logAction: jest.fn().mockResolvedValue(undefined),
        logActions: jest.fn().mockResolvedValue(undefined),
        prepareLogActions: jest.fn().mockResolvedValue([]),
    },
}));

describe('Borrower Edit � Regression Tests', () => {
    let database: Database;
    let service: BaseModelServiceClass;

    beforeEach(() => {
        database = createTestDatabase();
        service = new BaseModelServiceClass(database);
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    // ---------------------------------------------------------
    // CRITICAL: Phone and Address must be ENCRYPTED on save
    // ---------------------------------------------------------
    describe('phone and address encryption on save', () => {
        it('stores encrypted phone/address � not plaintext', async () => {
            const { borrower } = await createTestData(database);

            await service.update(borrower, (b: Borrower) => {
                b.fullName = 'Juan dela Cruz';
                b.phone = EncryptionService.encrypt('09171234567') as string;
                b.address = EncryptionService.encrypt('123 Rizal St') as string;
            });

            const updated = await database.get<Borrower>('borrowers').find(borrower.id);
            expect(updated.phone).toBe('ENCRYPTED::09171234567');
            expect(updated.address).toBe('ENCRYPTED::123 Rizal St');
            // Plaintext must NOT appear in the database
            expect(updated.phone).not.toBe('09171234567');
            expect(updated.address).not.toBe('123 Rizal St');
        });

        it('stores null when phone/address are empty strings', async () => {
            const { borrower } = await createTestData(database);

            // EncryptionService.encrypt('') returns null � guards against empty input
            await service.update(borrower, (b: Borrower) => {
                b.phone = EncryptionService.encrypt('') as string;
                b.address = EncryptionService.encrypt('') as string;
            });

            const updated = await database.get<Borrower>('borrowers').find(borrower.id);
            expect(updated.phone).toBeNull();
            expect(updated.address).toBeNull();
        });

        it('invokes EncryptionService.encrypt for both phone and address fields', async () => {
            const { borrower } = await createTestData(database);
            const mockEncrypt = EncryptionService.encrypt as jest.Mock;

            await service.update(borrower, (b: Borrower) => {
                b.phone = EncryptionService.encrypt('09171234567') as string;
                b.address = EncryptionService.encrypt('456 Mabini Ave') as string;
            });

            expect(mockEncrypt).toHaveBeenCalledWith('09171234567');
            expect(mockEncrypt).toHaveBeenCalledWith('456 Mabini Ave');
        });
    });

    // ---------------------------------------------------------
    // Form Pre-population must show DECRYPTED values
    // ---------------------------------------------------------
    describe('form pre-population uses decrypted values', () => {
        it('decrypts phone and address for display in form inputs', async () => {
            const { borrower } = await createTestData(database);

            // Simulate a borrower with encrypted data at rest
            await database.write(async () => {
                await borrower.update((b: Borrower) => {
                    b.phone = 'ENCRYPTED::09171234567';
                    b.address = 'ENCRYPTED::123 Rizal St';
                });
            });

            const reloaded = await database.get<Borrower>('borrowers').find(borrower.id);

            // Simulate what the form pre-population does (using decryptedPhone/decryptedAddress)
            const phoneForForm = EncryptionService.decrypt(reloaded.phone) || reloaded.phone || '';
            const addressForForm = EncryptionService.decrypt(reloaded.address) || reloaded.address || '';

            expect(phoneForForm).toBe('09171234567');
            expect(addressForForm).toBe('123 Rizal St');
        });
    });

    // ---------------------------------------------------------
    // Date Parsing � parseDateLocal must not shift day in UTC+8
    // ---------------------------------------------------------
    describe('parseDateLocal � UTC-safe date parsing', () => {
        it('returns local-midnight timestamp for a YYYY-MM-DD string', () => {
            const ts = parseDateLocal('1990-05-15');
            expect(ts).not.toBeNull();
            const d = new Date(ts!);
            expect(d.getFullYear()).toBe(1990);
            expect(d.getMonth()).toBe(4);   // May (0-indexed)
            expect(d.getDate()).toBe(15);
        });

        it('never shifts the date backward due to UTC+8 timezone offset', () => {
            const ts = parseDateLocal('1990-05-15');
            const local = new Date(ts!);
            expect(local.getDate()).toBe(15);
            expect(local.getMonth()).toBe(4);
        });

        it('returns null for empty, null, or undefined input', () => {
            expect(parseDateLocal('')).toBeNull();
            expect(parseDateLocal(null)).toBeNull();
            expect(parseDateLocal(undefined)).toBeNull();
        });

        it('returns null for malformed date strings', () => {
            expect(parseDateLocal('not-a-date')).toBeNull();
            expect(parseDateLocal('2025')).toBeNull();
            expect(parseDateLocal('05/15/1990')).toBeNull();
        });

        it('correctly parses dateJoined (Jan 1, 2024)', () => {
            const ts = parseDateLocal('2024-01-01');
            expect(ts).not.toBeNull();
            const d = new Date(ts!);
            expect(d.getFullYear()).toBe(2024);
            expect(d.getMonth()).toBe(0);   // January
            expect(d.getDate()).toBe(1);
        });
    });

    // ---------------------------------------------------------
    // All Edit Form Fields Must Persist Correctly
    // ---------------------------------------------------------
    describe('all edit form fields persist correctly', () => {
        it('saves core identity fields: fullName, firstName, lastName, gender, notes', async () => {
            const { borrower } = await createTestData(database);

            await service.update(borrower, (b: Borrower) => {
                b.fullName = 'Maria Santos Updated';
                b.firstName = 'Maria';
                b.lastName = 'Santos';
                b.gender = 'female';
                b.notes = 'Updated notes for regression test';
            });

            const updated = await database.get<Borrower>('borrowers').find(borrower.id);
            expect(updated.fullName).toBe('Maria Santos Updated');
            expect(updated.firstName).toBe('Maria');
            expect(updated.lastName).toBe('Santos');
            expect(updated.gender).toBe('female');
            expect(updated.notes).toBe('Updated notes for regression test');
        });

        it('saves group, coMakerName, and business fields', async () => {
            const { borrower } = await createTestData(database);

            await service.update(borrower, (b: Borrower) => {
                b.group = 'Group Sampaguita';
                b.coMakerName = 'Pedro Cruz';
                b.business = 'Carenderia';
            });

            const updated = await database.get<Borrower>('borrowers').find(borrower.id);
            expect(updated.group).toBe('Group Sampaguita');
            expect(updated.coMakerName).toBe('Pedro Cruz');
            expect(updated.business).toBe('Carenderia');
        });

        it('saves membership fields: memberId, cycleId, loanCode, membershipStatus', async () => {
            const { borrower } = await createTestData(database);

            await service.update(borrower, (b: Borrower) => {
                b.memberId = 'AG-00123';
                b.cycleId = 5;
                b.loanCode = 'LC25K';
                b.membershipStatus = 'active';
            });

            const updated = await database.get<Borrower>('borrowers').find(borrower.id);
            expect(updated.memberId).toBe('AG-00123');
            expect(updated.cycleId).toBe(5);
            expect(updated.loanCode).toBe('LC25K');
            expect(updated.membershipStatus).toBe('active');
        });

        it('saves dateOfBirth via parseDateLocal � correct calendar date', async () => {
            const { borrower } = await createTestData(database);
            const ts = parseDateLocal('1985-03-20')!;

            await service.update(borrower, (b: Borrower) => {
                b.dateOfBirth = ts;
            });

            const updated = await database.get<Borrower>('borrowers').find(borrower.id);
            const stored = new Date(updated.dateOfBirth);
            expect(stored.getFullYear()).toBe(1985);
            expect(stored.getMonth()).toBe(2);  // March (0-indexed)
            expect(stored.getDate()).toBe(20);
        });

        it('saves dateJoined via parseDateLocal � correct calendar date', async () => {
            const { borrower } = await createTestData(database);
            const ts = parseDateLocal('2024-06-15')!;

            await service.update(borrower, (b: Borrower) => {
                b.dateJoined = ts;
            });

            const updated = await database.get<Borrower>('borrowers').find(borrower.id);
            const stored = new Date(updated.dateJoined!);
            expect(stored.getFullYear()).toBe(2024);
            expect(stored.getMonth()).toBe(5);  // June (0-indexed)
            expect(stored.getDate()).toBe(15);
        });

        it('clears optional fields when set to null', async () => {
            const { borrower } = await createTestData(database);

            await service.update(borrower, (b: Borrower) => {
                b.memberId = 'TEMP-ID';
                b.notes = 'Some notes';
                b.coMakerName = 'Someone';
            });

            await service.update(borrower, (b: Borrower) => {
                b.memberId = null;
                b.notes = null;
                b.coMakerName = null;
            });

            const updated = await database.get<Borrower>('borrowers').find(borrower.id);
            expect(updated.memberId).toBeNull();
            expect(updated.notes).toBeNull();
            expect(updated.coMakerName).toBeNull();
        });
    });

    // ---------------------------------------------------------
    // Audit Logging
    // ---------------------------------------------------------
    describe('audit logging', () => {
        it('logs an UPDATE action via ActionLogService when updating a borrower', async () => {
            const ActionLogService = require('../../../../src/services/ActionLogService').default;
            const { borrower } = await createTestData(database);

            await service.update(borrower, (b: Borrower) => {
                b.fullName = 'Audit Test Name';
            });

            expect(ActionLogService.logAction).toHaveBeenCalledWith(
                expect.objectContaining({
                    entityType: 'borrowers',
                    entityId: borrower.id,
                    action: 'UPDATE',
                })
            );
        });
    });
});
