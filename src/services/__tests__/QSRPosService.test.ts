import { QSRPosService, OrderItemInput, PaymentTender } from '../QSRPosService';
import { database } from '../../database';

jest.mock('../../database', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn().mockImplementation((cb) => cb()),
        collections: {},
    },
}));

describe('QSRPosService', () => {
    describe('calculateOrderTotals', () => {
        const sampleItems: OrderItemInput[] = [
            { productId: 'ck-scut', name: 'Special Cut Fried Chicken', price: 50.0, quantity: 4 }, // 200
            { productId: 'ck-rice', name: 'Cooked Rice', price: 15.0, quantity: 4 }, // 60
            { productId: 'ck-sd10', name: 'Softdrinks 1.0L', price: 45.0, quantity: 1 }, // 45
        ]; // Total gross: 305.00

        it('calculates regular order with no discount correctly', () => {
            const totals = QSRPosService.calculateOrderTotals(sampleItems, { type: 'none' });

            expect(totals.grossTotal).toBe(305.0);
            expect(totals.discountAmount).toBe(0);
            expect(totals.netPayable).toBe(305.0);
            // 12% VAT breakdown for standard sales
            expect(totals.vatableSales).toBeCloseTo(305 / 1.12, 2);
            expect(totals.vatAmount).toBeCloseTo(305 - 305 / 1.12, 2);
            expect(totals.vatExemptSales).toBe(0);
        });

        it('calculates Philippine Senior Citizen / PWD 20% discount with VAT exemption correctly', () => {
            // Gross: 305.00
            // In PH statutory formula (RA 9994 / RA 10754):
            // VAT-exempt base = 305 / 1.12 = 272.3214...
            // 20% discount = base * 0.20 = 54.4642...
            // Net payable = base - discount = 217.857... (or base * 0.80)
            const totals = QSRPosService.calculateOrderTotals(sampleItems, {
                type: 'sc_pwd_20',
                idNumber: 'SC-12345',
            });

            expect(totals.grossTotal).toBe(305.0);
            expect(totals.vatExemptSales).toBeCloseTo(272.32, 2);
            expect(totals.vatAmount).toBe(0);
            expect(totals.discountAmount).toBeCloseTo(54.46, 2);
            expect(totals.netPayable).toBeCloseTo(217.86, 2);
        });

        it('calculates percentage discount correctly', () => {
            const totals = QSRPosService.calculateOrderTotals(sampleItems, {
                type: 'percentage',
                value: 10, // 10% off
            });

            expect(totals.grossTotal).toBe(305.0);
            expect(totals.discountAmount).toBe(30.5);
            expect(totals.netPayable).toBe(274.5);
        });

        it('calculates fixed amount discount correctly without going below zero', () => {
            const totals = QSRPosService.calculateOrderTotals(sampleItems, {
                type: 'fixed',
                value: 50,
            });

            expect(totals.grossTotal).toBe(305.0);
            expect(totals.discountAmount).toBe(50.0);
            expect(totals.netPayable).toBe(255.0);

            // Discount larger than total caps at grossTotal
            const capped = QSRPosService.calculateOrderTotals(sampleItems, {
                type: 'fixed',
                value: 500,
            });
            expect(capped.discountAmount).toBe(305.0);
            expect(capped.netPayable).toBe(0);
        });

        it('handles empty item list cleanly', () => {
            const totals = QSRPosService.calculateOrderTotals([], { type: 'none' });
            expect(totals.grossTotal).toBe(0);
            expect(totals.netPayable).toBe(0);
            expect(totals.discountAmount).toBe(0);
        });
    });

    describe('validatePayment', () => {
        it('validates exact cash payment', () => {
            const tenders: PaymentTender[] = [{ method: 'cash', amount: 305.0 }];
            const validation = QSRPosService.validatePayment(305.0, tenders);

            expect(validation.isValid).toBe(true);
            expect(validation.totalTendered).toBe(305.0);
            expect(validation.change).toBe(0);
        });

        it('validates cash payment with change', () => {
            const tenders: PaymentTender[] = [{ method: 'cash', amount: 500.0 }];
            const validation = QSRPosService.validatePayment(305.0, tenders);

            expect(validation.isValid).toBe(true);
            expect(validation.totalTendered).toBe(500.0);
            expect(validation.change).toBe(195.0);
        });

        it('rejects underpayment', () => {
            const tenders: PaymentTender[] = [{ method: 'cash', amount: 200.0 }];
            const validation = QSRPosService.validatePayment(305.0, tenders);

            expect(validation.isValid).toBe(false);
            expect(validation.totalTendered).toBe(200.0);
            expect(validation.error).toContain('Insufficient');
        });

        it('validates split-tender payment (Cash + GCash)', () => {
            const tenders: PaymentTender[] = [
                { method: 'gcash', amount: 200.0, referenceNumber: 'GCASH-998822' },
                { method: 'cash', amount: 105.0 },
            ];
            const validation = QSRPosService.validatePayment(305.0, tenders);

            expect(validation.isValid).toBe(true);
            expect(validation.totalTendered).toBe(305.0);
            expect(validation.change).toBe(0);
        });

        it('rejects split tender where non-cash exceeds required balance', () => {
            const tenders: PaymentTender[] = [
                { method: 'gcash', amount: 400.0, referenceNumber: 'GCASH-998822' }, // exceeds 305!
            ];
            const validation = QSRPosService.validatePayment(305.0, tenders);

            expect(validation.isValid).toBe(false);
            expect(validation.error).toContain('Non-cash payment cannot exceed');
        });
    });

    describe('generateOrderNumber', () => {
        it('generates sequential format CK-YYYYMMDD-XXXXX', () => {
            const orderNo = QSRPosService.generateOrderNumber();
            expect(orderNo).toMatch(/^CK-\d{8}-\w{5}$/);
        });
    });
});
