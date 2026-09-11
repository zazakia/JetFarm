import { createTestDatabase } from '../../__tests__/test-utils';

// We use a singleton for the mock to ensure all imports get the same database instance
export let database = createTestDatabase();

export const resetDatabase = () => {
    database = createTestDatabase();
};
