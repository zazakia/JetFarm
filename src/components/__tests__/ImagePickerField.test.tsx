import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ImagePickerField } from '../ImagePickerField';

// Mock AgriImageUploadService
jest.mock('../../services/AgriImageUploadService', () => ({
    AgriImageUploadService: {
        pickAndUpload: jest.fn(),
        isRemoteUrl: jest.fn((url: string) => url.startsWith('http')),
    },
}));

describe('ImagePickerField', () => {
    it('renders empty state with add photo button', () => {
        const onChange = jest.fn();
        const { getByTestId, getByText } = render(
            <ImagePickerField
                value={null}
                onChange={onChange}
                folder="test-folder"
                label="Attach Receipt"
            />
        );

        expect(getByText('Attach Receipt')).toBeTruthy();
        expect(getByTestId('image-picker-add-button')).toBeTruthy();
        expect(getByText('Tap to add photo')).toBeTruthy();
    });

    it('renders thumbnail and actions when value is provided', () => {
        const onChange = jest.fn();
        const { getByTestId, getByText, queryByTestId } = render(
            <ImagePickerField
                value="https://example.com/receipt.jpg"
                onChange={onChange}
                folder="test-folder"
                label="Receipt Photo"
            />
        );

        expect(getByText('Receipt Photo')).toBeTruthy();
        expect(getByTestId('image-picker-thumbnail')).toBeTruthy();
        expect(getByText('View')).toBeTruthy();
        expect(getByText('Replace')).toBeTruthy();
        expect(getByText('Remove')).toBeTruthy();
        expect(queryByTestId('image-picker-add-button')).toBeNull();
    });

    it('renders pending upload badge when isPending is true', () => {
        const onChange = jest.fn();
        const { getByText } = render(
            <ImagePickerField
                value="file:///data/user/0/cache/photo.jpg"
                onChange={onChange}
                folder="test-folder"
                isPending={true}
            />
        );

        expect(getByText('Uploading when online…')).toBeTruthy();
    });
});
