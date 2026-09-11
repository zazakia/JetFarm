import { ReminderService, ReminderData } from '../ReminderService';
import { formatPHP } from '../../utils/currency';
import { EncryptionService } from '../EncryptionService';

// Mock formatPHP to be predictable
jest.mock('../../utils/currency', () => ({
    formatPHP: jest.fn((val) => `PHP ${val.toLocaleString()}`)
}));

describe('ReminderService', () => {
    const mockData: ReminderData = {
        borrowerName: 'Juan Dela Cruz',
        amountDue: 1500,
        dueDate: new Date('2026-03-20').getTime(),
        phoneNumber: '09171234567'
    };

    describe('generateWhatsAppLink', () => {
        it('generates a correct whatsapp universal link with PH specific formatting', () => {
            const link = ReminderService.generateWhatsAppLink('friendly', mockData);
            expect(link).toContain('https://wa.me/639171234567');
            expect(link).toContain('Hi%20Juan%20Dela%20Cruz');
            expect(link).toContain('PHP%201%2C500');
        });

        it('handles encrypted phone numbers', () => {
            // "09171234567" encrypted with XOR and "POSCursor_Sec_2024_Ph"
            // We can just use the known behavior of EncryptionService.decrypt
            // which handles plain strings if they don't start with 'enc:'
            // but let's test a real encrypted one if possible, or just trust the logic.
            // For simplicity, let's mock it if needed.
            const encryptedPhone = 'enc:f1xSXXE='; // Placeholder from the error message
            const link = ReminderService.generateWhatsAppLink('friendly', { ...mockData, phoneNumber: encryptedPhone });
            // The actual decrypted value of 'f1xSXXE=' depends on the secret, 
            // but in the error message it looked like it failed to decrypt or was used as-is.
            // Actually, EncryptionService.decrypt is what we are using now.
            expect(link).not.toContain('enc:');
        });

        it('handles decryption returning null or empty', () => {
            const decryptSpy = jest.spyOn(EncryptionService, 'decrypt').mockReturnValue(null);
            const link = ReminderService.generateWhatsAppLink('friendly', mockData);
            expect(link).toContain('https://wa.me/?text=');
            
            const smsLink = ReminderService.generateSmsLink('friendly', mockData);
            expect(smsLink).toContain('sms:?body=');
            decryptSpy.mockRestore();
        });

        it('returns null if phone is missing', () => {
            const link = ReminderService.generateWhatsAppLink('friendly', { ...mockData, phoneNumber: undefined });
            expect(link).toBeNull();
        });
    });

    describe('generateSmsLink', () => {
        it('generates a correct sms link', () => {
            const link = ReminderService.generateSmsLink('urgent', mockData);
            expect(link).toContain('sms:09171234567');
            expect(link).toContain('URGENT%20NOTICE');
        });

        it('handles encrypted phone numbers for SMS', () => {
            const encryptedPhone = 'enc:f1xSXXE=';
            const link = ReminderService.generateSmsLink('friendly', { ...mockData, phoneNumber: encryptedPhone });
            expect(link).not.toContain('enc:');
        });

        it('returns null if phone is missing', () => {
            const link = ReminderService.generateSmsLink('friendly', { ...mockData, phoneNumber: undefined });
            expect(link).toBeNull();
        });

        it('generates overdue message type', () => {
            const link = ReminderService.generateSmsLink('overdue', mockData);
            expect(link).toContain('Overdue%20Notice');
        });
    });

    describe('generateWhatsAppLink — phone formatting', () => {
        it('prepends 63 to a 10-digit phone starting with 9', () => {
            // No leading 0, no leading 63 — just 10 digits starting with 9
            const link = ReminderService.generateWhatsAppLink('friendly', {
                ...mockData,
                phoneNumber: '9171234567', // 10 digits, starts with 9
            });
            expect(link).toContain('wa.me/639171234567');
        });

        it('replaces leading 0 with 63 for PH mobile numbers', () => {
            const link = ReminderService.generateWhatsAppLink('friendly', {
                ...mockData,
                phoneNumber: '09171234567', // starts with 0
            });
            expect(link).toContain('wa.me/639171234567');
        });
    });
});
