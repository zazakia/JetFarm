/**
 * AgriImageUploadService Tests
 * RED phase — these must fail before implementation exists.
 */
import { AgriImageUploadService } from '../AgriImageUploadService';

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(),
    requestMediaLibraryPermissionsAsync: jest.fn(),
    MediaTypeOptions: { Images: 'Images' },
    UIImagePickerPresentationStyle: { FullScreen: 'FullScreen' },
}));

// Mock expo-file-system and legacy subpath
jest.mock('expo-file-system', () => ({
    readAsStringAsync: jest.fn(),
    EncodingType: { Base64: 'base64' },
}));
jest.mock('expo-file-system/legacy', () => ({
    readAsStringAsync: jest.fn(),
    EncodingType: { Base64: 'base64' },
}));

// Mock Supabase
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
jest.mock('../../database/supabase', () => ({
    supabase: {
        storage: {
            from: jest.fn(() => ({
                upload: mockUpload,
                getPublicUrl: mockGetPublicUrl,
            })),
        },
    },
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
    fetch: jest.fn(),
}));

import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';

const mockImagePicker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;
const mockReadAsString = readAsStringAsync as jest.Mock;

describe('AgriImageUploadService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('pickImage', () => {
        it('returns null when user cancels camera', async () => {
            (mockImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
            (mockImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });

            const result = await AgriImageUploadService.pickImage('camera');
            expect(result).toBeNull();
        });

        it('returns local URI when camera capture succeeds', async () => {
            (mockImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
            (mockImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
                canceled: false,
                assets: [{ uri: 'file:///tmp/photo.jpg', width: 1920, height: 1080 }],
            });

            const result = await AgriImageUploadService.pickImage('camera');
            expect(result).toBe('file:///tmp/photo.jpg');
        });

        it('returns null when camera permission denied', async () => {
            (mockImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

            const result = await AgriImageUploadService.pickImage('camera');
            expect(result).toBeNull();
        });

        it('returns local URI when gallery pick succeeds', async () => {
            (mockImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
            (mockImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
                canceled: false,
                assets: [{ uri: 'file:///gallery/photo.jpg', width: 800, height: 600 }],
            });

            const result = await AgriImageUploadService.pickImage('gallery');
            expect(result).toBe('file:///gallery/photo.jpg');
        });
    });

    describe('uploadToStorage', () => {
        it('uploads file and returns public URL when online', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            mockReadAsString.mockResolvedValue('aGVsbG8='); // valid: "hello"
            mockUpload.mockResolvedValue({ data: { path: 'growth-checkins/abc.jpg' }, error: null });
            mockGetPublicUrl.mockReturnValue({
                data: { publicUrl: 'https://supabase.818.quest/storage/v1/object/public/farm-photos/growth-checkins/abc.jpg' },
            });

            const result = await AgriImageUploadService.uploadToStorage(
                'file:///tmp/photo.jpg',
                'growth-checkins'
            );

            expect(result.isPending).toBe(false);
            expect(result.url).toContain('farm-photos');
        });

        it('returns local URI with isPending=true when offline', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

            const result = await AgriImageUploadService.uploadToStorage(
                'file:///tmp/photo.jpg',
                'growth-checkins'
            );

            expect(result.isPending).toBe(true);
            expect(result.url).toBe('file:///tmp/photo.jpg');
        });

        it('falls back to local URI when upload fails', async () => {
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            mockReadAsString.mockResolvedValue('aGVsbG8='); // valid base64
            mockUpload.mockResolvedValue({ data: null, error: { message: 'Storage error' } });

            const result = await AgriImageUploadService.uploadToStorage(
                'file:///tmp/photo.jpg',
                'growth-checkins'
            );

            expect(result.isPending).toBe(true);
            expect(result.url).toBe('file:///tmp/photo.jpg');
        });
    });

    describe('pickAndUpload', () => {
        it('returns null when picker cancelled', async () => {
            (mockImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
            (mockImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });

            const result = await AgriImageUploadService.pickAndUpload('growth-checkins', 'camera');
            expect(result).toBeNull();
        });

        it('returns UploadResult when online and upload succeeds', async () => {
            (mockImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
            (mockImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
                canceled: false,
                assets: [{ uri: 'file:///tmp/photo.jpg' }],
            });
            (mockNetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
            mockReadAsString.mockResolvedValue('aGVsbG8='); // valid base64
            mockUpload.mockResolvedValue({ data: { path: 'growth-checkins/uuid.jpg' }, error: null });
            mockGetPublicUrl.mockReturnValue({
                data: { publicUrl: 'https://supabase.818.quest/storage/v1/object/public/farm-photos/growth-checkins/uuid.jpg' },
            });

            const result = await AgriImageUploadService.pickAndUpload('growth-checkins', 'camera');
            expect(result).not.toBeNull();
            expect(result!.isPending).toBe(false);
            expect(result!.url).toContain('https://');
        });
    });

    describe('isRemoteUrl', () => {
        it('returns true for https URLs', () => {
            expect(AgriImageUploadService.isRemoteUrl('https://example.com/photo.jpg')).toBe(true);
        });

        it('returns false for local file URIs', () => {
            expect(AgriImageUploadService.isRemoteUrl('file:///tmp/photo.jpg')).toBe(false);
        });

        it('returns false for empty string', () => {
            expect(AgriImageUploadService.isRemoteUrl('')).toBe(false);
        });
    });
});
