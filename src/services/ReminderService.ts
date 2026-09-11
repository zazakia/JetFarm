import { formatPHP } from '../utils/currency';
import { EncryptionService } from './EncryptionService';

export type ReminderType = 'friendly' | 'overdue' | 'urgent';

export interface ReminderData {
    borrowerName: string;
    amountDue: number;
    dueDate: number;
    phoneNumber?: string;
}

export class ReminderService {
    private static getMessage(type: ReminderType, data: ReminderData): string {
        const amount = formatPHP(data.amountDue);
        const dateStr = new Date(data.dueDate).toLocaleDateString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        switch (type) {
            case 'urgent':
                return `URGENT NOTICE: Hi ${data.borrowerName}, your payment of ${amount} was due on ${dateStr}. Please settle this immediately to avoid penalties. Contact us if you have any questions.`;
            case 'overdue':
                return `Overdue Notice: Hi ${data.borrowerName}, a payment of ${amount} due on ${dateStr} is still outstanding. Please settle it as soon as possible. Thank you!`;
            case 'friendly':
            default:
                return `Friendly Reminder: Hi ${data.borrowerName}, just a quick reminder that your payment of ${amount} is due on ${dateStr}. Thank you!`;
        }
    }

    static generateWhatsAppLink(type: ReminderType, data: ReminderData): string | null {
        if (!data.phoneNumber) return null;
        
        // Decrypt phone number if it's encrypted
        const decryptedPhone = EncryptionService.decrypt(data.phoneNumber) || '';
        
        const message = this.getMessage(type, data);
        const cleanPhone = decryptedPhone.replace(/\D/g, '');
        
        // For PH, if it starts with 0, replace with 63. If it starts with 9, prepend 63.
        let formattedPhone = cleanPhone;
        if (cleanPhone.startsWith('0')) {
            formattedPhone = '63' + cleanPhone.substring(1);
        } else if (cleanPhone.length === 10 && cleanPhone.startsWith('9')) {
            formattedPhone = '63' + cleanPhone;
        }

        // Use universal link for better compatibility (mobile & web)
        return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    }

    static generateSmsLink(type: ReminderType, data: ReminderData): string | null {
        if (!data.phoneNumber) return null;
        
        // Decrypt phone number if it's encrypted
        const decryptedPhone = EncryptionService.decrypt(data.phoneNumber) || '';
        const message = this.getMessage(type, data);
        
        return `sms:${decryptedPhone}?body=${encodeURIComponent(message)}`;
    }
}
