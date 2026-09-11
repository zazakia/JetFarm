import { Alert, Platform } from 'react-native';

/**
 * Formats a field name from camelCase/snake_case/kebab-case to a readable Title Case.
 */
export function formatFieldName(field: string): string {
    return field
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Handles React Hook Form validation failures by showing a clear,
 * detailed alert listing which fields have validation errors.
 */
export function handleFormValidationError(errors: Record<string, any>, moduleName?: string) {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    const messages = errorFields
        .map((field) => {
            const err = errors[field];
            const name = formatFieldName(field);
            return `- ${name}: ${err.message || 'Invalid value'}`;
        })
        .join('\n');

    const prefix = moduleName ? `Saving ${moduleName} failed` : 'Submission failed';
    const msg = `${prefix}. Please correct the following errors before saving:\n\n${messages}`;

    if (Platform.OS === 'web') {
        window.alert(msg);
    } else {
        Alert.alert("Validation Error", msg);
    }
}

/**
 * Handles database/API save/update/delete failures by showing a clear
 * alert containing the detailed error message.
 */
export function handleSaveError(error: any, moduleName: string, action: 'save' | 'update' | 'delete' = 'save') {
    console.error(`Failed to ${action} ${moduleName}:`, error);
    const detail = error?.message || String(error);
    const msg = `Failed to ${action} ${moduleName}.\n\nReason: ${detail}`;

    if (Platform.OS === 'web') {
        window.alert(msg);
    } else {
        Alert.alert("Error", msg);
    }
}
