import { FieldErrors, Resolver } from 'react-hook-form';
import { z } from 'zod';

type ZodIssue = z.core.$ZodIssue;

function issuePathToKey(path: PropertyKey[]): string {
    return path.length > 0 ? path.map(String).join('.') : 'root';
}

export function zodIssuesToFieldErrors<TFieldValues extends Record<string, any>>(
    issues: ZodIssue[]
): FieldErrors<TFieldValues> {
    return issues.reduce((errors, issue) => {
        const key = issuePathToKey(issue.path);
        if (!(errors as Record<string, unknown>)[key]) {
            (errors as Record<string, unknown>)[key] = {
                type: issue.code,
                message: issue.message,
            };
        }
        return errors;
    }, {} as FieldErrors<TFieldValues>);
}

export function createSafeZodResolver<TFieldValues extends Record<string, any>>(
    schema: z.ZodType<TFieldValues>
): Resolver<TFieldValues> {
    return async (values) => {
        try {
            const result = await schema.safeParseAsync(values);
            if (result.success) {
                return {
                    values: result.data,
                    errors: {},
                };
            }

            return {
                values: {},
                errors: zodIssuesToFieldErrors<TFieldValues>(result.error.issues),
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Validation failed.';
            return {
                values: {},
                errors: {
                    root: {
                        type: 'validation',
                        message,
                    },
                } as FieldErrors<TFieldValues>,
            };
        }
    };
}
