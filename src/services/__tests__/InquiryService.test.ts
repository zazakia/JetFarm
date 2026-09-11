import { InquiryService } from '../InquiryService';
import { supabase } from '../../database/supabase';
import { COMPANY_NAME } from '../../constants/brand';

const mockInsert = jest.fn();
const mockFrom = jest.fn(() => ({ insert: mockInsert }));

jest.mock('../../database/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({ insert: mockInsert })),
    },
}));

describe('InquiryService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (supabase.from as jest.Mock).mockImplementation(mockFrom);
        mockInsert.mockResolvedValue({ error: null });
    });

    it('normalizes and submits a demo inquiry to Supabase', async () => {
        await InquiryService.submitDemoInquiry({
            fullName: '  Juan Client ',
            businessName: '  Juan Lending ',
            contactNumber: ' 09171234567 ',
            email: ' client@example.com ',
            message: ' Need setup details ',
        });

        expect(supabase.from).toHaveBeenCalledWith('demo_inquiries');
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
            full_name: 'Juan Client',
            business_name: 'Juan Lending',
            contact_number: '09171234567',
            email: 'client@example.com',
            message: 'Need setup details',
            admin_email: 'cybergada@gmail.com',
            admin_whatsapp: '639811254446',
            status: 'new',
        }));
    });

    it('requires name, business, and contact number', async () => {
        await expect(InquiryService.submitDemoInquiry({
            fullName: '',
            businessName: 'Business',
            contactNumber: '0917',
        })).rejects.toThrow('Please enter your name.');

        await expect(InquiryService.submitDemoInquiry({
            fullName: 'Client',
            businessName: '',
            contactNumber: '0917',
        })).rejects.toThrow('Please enter your lending business name.');

        await expect(InquiryService.submitDemoInquiry({
            fullName: 'Client',
            businessName: 'Business',
            contactNumber: '',
        })).rejects.toThrow('Please enter your contact number.');
    });

    it('builds admin WhatsApp and email notification links', () => {
        const links = InquiryService.buildAdminNotificationLinks({
            fullName: 'Client',
            businessName: 'ABC Lending',
            contactNumber: '09171234567',
            email: 'client@example.com',
            message: 'Interested',
        });

        expect(links.whatsappUrl).toContain('https://wa.me/639811254446');
        expect(decodeURIComponent(links.whatsappUrl)).toContain(`New ${COMPANY_NAME} demo inquiry`);
        expect(links.mailtoUrl).toContain('mailto:cybergada@gmail.com');
        expect(decodeURIComponent(links.mailtoUrl)).toContain('ABC Lending');
    });

    it('surfaces Supabase insert errors', async () => {
        mockInsert.mockResolvedValueOnce({ error: { message: 'permission denied' } });

        await expect(InquiryService.submitDemoInquiry({
            fullName: 'Client',
            businessName: 'Business',
            contactNumber: '0917',
        })).rejects.toEqual(expect.objectContaining({ context: expect.stringContaining('permission denied') }));
    });
});
