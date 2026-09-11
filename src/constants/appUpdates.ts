import { MaterialIcons } from '@expo/vector-icons';
import { GENERATED_APP_UPDATES } from './generatedAppUpdates';

export type AppUpdateCategory = 'feature' | 'fix' | 'technical' | 'data';

export type AppUpdateEntry = {
    id: string;
    version: string;
    versionLabel?: string;
    date: string;
    title: string;
    category: AppUpdateCategory;
    icon: keyof typeof MaterialIcons.glyphMap;
    summary: string;
    changes: string[];
    codeChanges: string[];
};

export const APP_UPDATES: AppUpdateEntry[] = GENERATED_APP_UPDATES;

export const APP_UPDATE_CATEGORY_LABELS: Record<AppUpdateCategory, string> = {
    feature: 'Feature',
    fix: 'Fix',
    technical: 'Technical',
    data: 'Data',
};

export const APP_UPDATE_CATEGORY_COLORS: Record<AppUpdateCategory, string> = {
    feature: '#1E3A8A',
    fix: '#1E3A8A',
    technical: '#4F46E5',
    data: '#B45309',
};
