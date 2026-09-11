import { z } from 'zod';
import { createSafeZodResolver, zodIssuesToFieldErrors } from '../zodFormResolver';

describe('zodFormResolver', () => {
    it('converts zod issues into react-hook-form field errors', () => {
        const errors = zodIssuesToFieldErrors<{ borrowerId: string; root: string }>([
            {
                origin: 'string',
                code: 'too_small',
                minimum: 1,
                inclusive: true,
                path: ['borrowerId'],
                message: 'Borrower is required',
            } as any,
            {
                origin: 'string',
                code: 'invalid_type',
                path: ['borrowerId'],
                message: 'Duplicate error message',
            } as any,
            {
                origin: 'string',
                code: 'custom',
                path: [],
                message: 'Root issue',
            } as any,
        ]);

        expect(errors.borrowerId?.message).toBe('Borrower is required');
        expect(errors.borrowerId?.type).toBe('too_small');
        expect(errors.root?.message).toBe('Root issue');
        expect(errors.root?.type).toBe('custom');
    });

    it('returns field errors instead of throwing when validation fails', async () => {
        const resolver = createSafeZodResolver(
            z.object({
                borrowerId: z.string().min(1, 'Borrower is required'),
                principal: z.string().min(1, 'Principal is required'),
            })
        );

        await expect(
            resolver({ borrowerId: '', principal: '5000' }, {} as any, {} as any)
        ).resolves.toMatchObject({
            values: {},
            errors: {
                borrowerId: {
                    message: 'Borrower is required',
                },
            },
        });
    });

    it('returns parsed values when validation succeeds', async () => {
        const resolver = createSafeZodResolver(
            z.object({
                borrowerId: z.string().min(1),
            })
        );

        await expect(
            resolver({ borrowerId: 'borrower-1' }, {} as any, {} as any)
        ).resolves.toEqual({
            values: { borrowerId: 'borrower-1' },
            errors: {},
        });
    });

    it('returns root error when safeParseAsync throws an Error object', async () => {
        const throwingSchema = {
            safeParseAsync: jest.fn().mockRejectedValue(new Error('Unexpected parse error')),
        } as any;
        const resolver = createSafeZodResolver(throwingSchema);

        await expect(
            resolver({ borrowerId: 'borrower-1' }, {} as any, {} as any)
        ).resolves.toEqual({
            values: {},
            errors: {
                root: {
                    type: 'validation',
                    message: 'Unexpected parse error',
                },
            },
        });
    });

    it('returns root error with default message when safeParseAsync throws a non-Error object', async () => {
        const throwingSchema = {
            safeParseAsync: jest.fn().mockRejectedValue('String error'),
        } as any;
        const resolver = createSafeZodResolver(throwingSchema);

        await expect(
            resolver({ borrowerId: 'borrower-1' }, {} as any, {} as any)
        ).resolves.toEqual({
            values: {},
            errors: {
                root: {
                    type: 'validation',
                    message: 'Validation failed.',
                },
            },
        });
    });
});
