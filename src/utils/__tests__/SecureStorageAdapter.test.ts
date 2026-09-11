const mockPlatform = {
  OS: 'web',
};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: mockPlatform,
}));

describe('SecureStorageAdapter', () => {
  let originalLocalStorage: any;

  beforeAll(() => {
    originalLocalStorage = (global as any).localStorage;
  });

  afterAll(() => {
    (global as any).localStorage = originalLocalStorage;
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('Web Platform', () => {
    beforeEach(() => {
      mockPlatform.OS = 'web';
      // Setup mock localStorage
      const store: Record<string, string> = {};
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: jest.fn((key) => store[key] || null),
          setItem: jest.fn((key, val) => { store[key] = val; }),
          removeItem: jest.fn((key) => { delete store[key]; }),
        },
        writable: true,
        configurable: true,
      });
    });

    test('getItem returns value from localStorage', async () => {
      const { SecureStorageAdapter } = require('../SecureStorageAdapter');
      localStorage.setItem('test-key', 'web-value');
      const val = await SecureStorageAdapter.getItem('test-key');
      expect(val).toBe('web-value');
      expect(localStorage.getItem).toHaveBeenCalledWith('test-key');
    });

    test('getItem returns null if localStorage is undefined', async () => {
      Object.defineProperty(global, 'localStorage', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const { SecureStorageAdapter } = require('../SecureStorageAdapter');
      const val = await SecureStorageAdapter.getItem('test-key');
      expect(val).toBeNull();
    });

    test('setItem stores value in localStorage', async () => {
      const { SecureStorageAdapter } = require('../SecureStorageAdapter');
      await SecureStorageAdapter.setItem('test-key', 'web-value');
      expect(localStorage.setItem).toHaveBeenCalledWith('test-key', 'web-value');
    });

    test('setItem does nothing if localStorage is undefined', async () => {
      Object.defineProperty(global, 'localStorage', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const { SecureStorageAdapter } = require('../SecureStorageAdapter');
      await expect(SecureStorageAdapter.setItem('test-key', 'web-value')).resolves.not.toThrow();
    });

    test('removeItem deletes value from localStorage', async () => {
      const { SecureStorageAdapter } = require('../SecureStorageAdapter');
      await SecureStorageAdapter.removeItem('test-key');
      expect(localStorage.removeItem).toHaveBeenCalledWith('test-key');
    });

    test('removeItem does nothing if localStorage is undefined', async () => {
      Object.defineProperty(global, 'localStorage', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const { SecureStorageAdapter } = require('../SecureStorageAdapter');
      await expect(SecureStorageAdapter.removeItem('test-key')).resolves.not.toThrow();
    });
  });

  describe('Mobile Platform', () => {
    beforeEach(() => {
      mockPlatform.OS = 'ios';
    });

    test('getItem returns value from SecureStore', async () => {
      const SecureStore = require('expo-secure-store');
      const mockGetItem = SecureStore.getItemAsync as jest.Mock;
      mockGetItem.mockResolvedValue('secure-value');

      const { SecureStorageAdapter } = require('../SecureStorageAdapter');
      const val = await SecureStorageAdapter.getItem('test-key');
      expect(val).toBe('secure-value');
      expect(mockGetItem).toHaveBeenCalledWith('test-key');
    });

    test('getItem handles errors and returns null', async () => {
      const SecureStore = require('expo-secure-store');
      const mockGetItem = SecureStore.getItemAsync as jest.Mock;
      mockGetItem.mockRejectedValue(new Error('SecureStore Error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { SecureStorageAdapter } = require('../SecureStorageAdapter');
      const val = await SecureStorageAdapter.getItem('test-key');
      expect(val).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    test('setItem stores value in SecureStore', async () => {
      const SecureStore = require('expo-secure-store');
      const mockSetItem = SecureStore.setItemAsync as jest.Mock;
      mockSetItem.mockResolvedValue(undefined);

      const { SecureStorageAdapter } = require('../SecureStorageAdapter');
      await SecureStorageAdapter.setItem('test-key', 'secure-value');
      expect(mockSetItem).toHaveBeenCalledWith('test-key', 'secure-value');
    });

    test('setItem handles errors gracefully', async () => {
      const SecureStore = require('expo-secure-store');
      const mockSetItem = SecureStore.setItemAsync as jest.Mock;
      mockSetItem.mockRejectedValue(new Error('SecureStore Error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { SecureStorageAdapter } = require('../SecureStorageAdapter');
      await expect(SecureStorageAdapter.setItem('test-key', 'secure-value')).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    test('removeItem deletes value from SecureStore', async () => {
      const SecureStore = require('expo-secure-store');
      const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock;
      mockDeleteItem.mockResolvedValue(undefined);

      const { SecureStorageAdapter } = require('../SecureStorageAdapter');
      await SecureStorageAdapter.removeItem('test-key');
      expect(mockDeleteItem).toHaveBeenCalledWith('test-key');
    });

    test('removeItem handles errors gracefully', async () => {
      const SecureStore = require('expo-secure-store');
      const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock;
      mockDeleteItem.mockRejectedValue(new Error('SecureStore Error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { SecureStorageAdapter } = require('../SecureStorageAdapter');
      await expect(SecureStorageAdapter.removeItem('test-key')).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
