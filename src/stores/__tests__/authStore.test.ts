import { useAuthStore } from '../authStore';

describe('authStore', () => {
    beforeEach(() => {
        useAuthStore.getState().reset();
    });

    it('sets user correctly', () => {
        const mockUser = { id: 'u1', email: 'test@example.com' } as any;
        useAuthStore.getState().setUser(mockUser);
        expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('sets role correctly', () => {
        useAuthStore.getState().setRole('admin');
        expect(useAuthStore.getState().role).toBe('admin');
    });

    it('sets loading correctly', () => {
        useAuthStore.getState().setLoading(false);
        expect(useAuthStore.getState().loading).toBe(false);
    });

    it('resets state correctly', () => {
        useAuthStore.getState().setUser({ id: 'u1' } as any);
        useAuthStore.getState().setRole('admin');
        useAuthStore.getState().setLoading(true);

        useAuthStore.getState().reset();

        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().role).toBeNull();
        expect(useAuthStore.getState().loading).toBe(false);
    });
});
