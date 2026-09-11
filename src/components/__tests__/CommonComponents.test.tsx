import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StatCard } from '../StatCard';
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import { SearchBar } from '../SearchBar';
import { MetricBreakdownDialog } from '../MetricBreakdownDialog';
import { useSyncStore } from '../../stores/syncStore';

// Mocks
jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
  Ionicons: 'Ionicons',
}));

jest.mock('../../stores/syncStore', () => ({
  useSyncStore: jest.fn(),
}));

// Mock formatPHP to avoid dependency issues in basic tests
jest.mock('../../utils/currency', () => ({
  formatPHP: jest.fn().mockImplementation((val) => `PHP ${val}`)
}));

describe('Common UI Components', () => {
  
  describe('StatCard', () => {
    it('renders title and value', () => {
      const { getByText } = render(
        <StatCard title="Total Users" value={100} icon="person" color="text-blue-600" />
      );
      expect(getByText('Total Users')).toBeTruthy();
      expect(getByText('100')).toBeTruthy();
    });

    it('renders subtitle if provided', () => {
      const { getByText } = render(
        <StatCard title="Title" value="Value" icon="person" color="text-blue-600" subtitle="Subtitle" />
      );
      expect(getByText('Subtitle')).toBeTruthy();
    });

    it('handles onPress if provided', () => {
      const onPressMock = jest.fn();
      const { getByText } = render(
        <StatCard title="Clickable" value="10" icon="person" color="text-blue-600" onPress={onPressMock} />
      );
      fireEvent.press(getByText('Clickable'));
      expect(onPressMock).toHaveBeenCalled();
    });
  });

  describe('SyncStatusIndicator', () => {
    it('renders idle/completed state', () => {
      (useSyncStore as unknown as jest.Mock).mockReturnValue({
        status: 'completed',
        pendingChanges: 0,
        lastSyncAt: new Date()
      });
      const { getByText } = render(<SyncStatusIndicator />);
      expect(getByText('Synced')).toBeTruthy();
    });

    it('renders syncing state', () => {
      (useSyncStore as unknown as jest.Mock).mockReturnValue({
        status: 'syncing',
        pendingChanges: 0,
        lastSyncAt: new Date()
      });
      const { getByText } = render(<SyncStatusIndicator />);
      expect(getByText('Syncing')).toBeTruthy();
    });

    it('renders error state', () => {
      (useSyncStore as unknown as jest.Mock).mockReturnValue({
        status: 'error',
        pendingChanges: 0,
        lastSyncAt: new Date()
      });
      const { getByText } = render(<SyncStatusIndicator />);
      expect(getByText('Sync Fail')).toBeTruthy();
    });
  });

  describe('SearchBar', () => {
    it('renders with placeholder and handles text change', () => {
      const onChangeTextMock = jest.fn();
      const { getByPlaceholderText } = render(
        <SearchBar value="" onChangeText={onChangeTextMock} placeholder="Find..." />
      );
      const input = getByPlaceholderText('Find...');
      expect(input).toBeTruthy();
      fireEvent.changeText(input, 'test query');
      expect(onChangeTextMock).toHaveBeenCalledWith('test query');
    });

    it('renders clear button when value is present and handles clear press', () => {
      const onChangeTextMock = jest.fn();
      const onClearMock = jest.fn();
      const { getByTestId } = render(
        <SearchBar value="gonzal" onChangeText={onChangeTextMock} onClear={onClearMock} />
      );
      const clearBtn = getByTestId('clear-search-button');
      expect(clearBtn).toBeTruthy();
      fireEvent.press(clearBtn);
      expect(onChangeTextMock).toHaveBeenCalledWith('');
      expect(onClearMock).toHaveBeenCalled();
    });
  });

  describe('MetricBreakdownDialog', () => {
    it('renders content when visible', () => {
      const items = [{ id: '1', label: 'Item 1', value: 10 }];
      const { getByText } = render(
        <MetricBreakdownDialog 
          visible={true} 
          onClose={jest.fn()} 
          title="Breakdown" 
          total={10} 
          items={items} 
          color="bg-blue-600" 
        />
      );
      expect(getByText('Breakdown')).toBeTruthy();
      expect(getByText('Item 1')).toBeTruthy();
    });

    it('renders empty message if no items', () => {
      const { getByText } = render(
        <MetricBreakdownDialog 
          visible={true} 
          onClose={jest.fn()} 
          title="Empty" 
          total={0} 
          items={[]} 
          color="bg-blue-600" 
        />
      );
      expect(getByText('No data available for this metric.')).toBeTruthy();
    });
  });
});
