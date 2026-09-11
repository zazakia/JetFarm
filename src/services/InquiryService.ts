import { supabase } from '../database/supabase';
import { COMPANY_NAME } from '../constants/brand';
import { ErrorService } from "./ErrorService";

export type DemoInquiryInput = {
    fullName: string;
    businessName: string;
    contactNumber: string;
    email?: string;
    message?: string;
};

export const DEMO_ADMIN_CONTACT = {
    email: 'cybergada@gmail.com',
    whatsappDisplay: '09811254446',
    whatsappInternational: '639811254446',
};

function clean(value?: string) {
    return (value || '').trim();
}

export class InquiryService {
    static normalizeInquiry(input: DemoInquiryInput) {
        const normalized = {
            fullName: clean(input.fullName),
            businessName: clean(input.businessName),
            contactNumber: clean(input.contactNumber),
            email: clean(input.email),
            message: clean(input.message),
        };

        if (!normalized.fullName) {
            throw new Error('Please enter your name.');
        }
        if (!normalized.businessName) {
            throw new Error('Please enter your lending business name.');
        }
        if (!normalized.contactNumber) {
            throw new Error('Please enter your contact number.');
        }

        return normalized;
    }

    static buildAdminNotificationMessage(input: DemoInquiryInput) {
        const inquiry = this.normalizeInquiry(input);
        return [
            `New ${COMPANY_NAME} demo inquiry`,
            `Name: ${inquiry.fullName}`,
            `Business: ${inquiry.businessName}`,
            `Contact: ${inquiry.contactNumber}`,
            inquiry.email ? `Email: ${inquiry.email}` : null,
            inquiry.message ? `Message: ${inquiry.message}` : null,
        ].filter(Boolean).join('\n');
    }

    static buildAdminNotificationLinks(input: DemoInquiryInput) {
        const message = this.buildAdminNotificationMessage(input);
        const subject = `New ${COMPANY_NAME} Demo Inquiry`;

        return {
            whatsappUrl: `https://wa.me/${DEMO_ADMIN_CONTACT.whatsappInternational}?text=${encodeURIComponent(message)}`,
            mailtoUrl: `mailto:${DEMO_ADMIN_CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
        };
    }

    static async submitDemoInquiry(input: DemoInquiryInput) {
        const inquiry = this.normalizeInquiry(input);
        const { error } = await supabase.from('demo_inquiries').insert({
            full_name: inquiry.fullName,
            business_name: inquiry.businessName,
            contact_number: inquiry.contactNumber,
            email: inquiry.email || null,
            message: inquiry.message || null,
            admin_email: DEMO_ADMIN_CONTACT.email,
            admin_whatsapp: DEMO_ADMIN_CONTACT.whatsappInternational,
            status: 'new',
        });

        if (error) {
            throw ErrorService.handleError(error, error.message || 'Unable to submit inquiry.');
        }

        return inquiry;
    }
}
