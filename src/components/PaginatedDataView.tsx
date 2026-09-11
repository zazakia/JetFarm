import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Q, Model } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import BaseModelService from '../services/BaseModelService';

export type ViewMode = 'table' | 'list' | 'card';

export interface Column<T> {
  key: string;
  label: string;
  width?: number | string;
  render?: (item: T) => React.ReactNode;
  /** Optional: extract a primitive for client-side sort. Set to null to disable sorting for this column. */
  sortValue?: ((item: T) => string | number | null) | null;
}

type SortDir = 'asc' | 'desc';

interface PaginatedDataViewProps<T extends Model> {
  tableName: string;
  queryClauses?: Q.Clause[];
  renderListItem?: (item: T) => React.ReactNode;
  renderCardItem?: (item: T) => React.ReactNode;
  columns: Column<T>[];
  pageSize?: number;
  defaultViewMode?: ViewMode;
  emptyIcon?: keyof typeof MaterialIcons.glyphMap;
  emptyMessage?: string;
  filterItem?: (item: T) => boolean;
}

export function PaginatedDataView<T extends Model>({
  tableName,
  queryClauses = [],
  renderListItem,
  renderCardItem,
  columns,
  pageSize = 20,
  defaultViewMode = 'table',
  emptyIcon = 'inbox',
  emptyMessage = 'No data found',
  filterItem,
}: PaginatedDataViewProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const displayData = useMemo(() => {
    const filtered = filterItem ? data.filter(filterItem) : data;
    if (!sortKey) return filtered;
    const col = columns.find(c => c.key === sortKey);
    if (!col || col.sortValue === null) return filtered;
    const getValue = col.sortValue ?? ((item: T) => (item as any)[col.key]);
    return [...filtered].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, filterItem, sortKey, sortDir, columns]);

  const handleHeaderPress = (col: Column<T>) => {
    if (col.sortValue === null || !col.label) return;
    if (sortKey === col.key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  // Track clauses JSON string to detect changes
  const clausesHash = JSON.stringify(queryClauses);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await BaseModelService.fetchPaginated<T>(tableName, queryClauses, 0, pageSize);
      setData(results);
      setHasMore(results.length === pageSize);
    } catch (error) {
      console.error(`Failed to load ${tableName}:`, error);
    } finally {
      setLoading(false);
    }
  }, [tableName, clausesHash, pageSize]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const fetchMoreData = async () => {
    if (loadingMore || !hasMore || loading) return;
    
    setLoadingMore(true);
    try {
      const results = await BaseModelService.fetchPaginated<T>(tableName, queryClauses, data.length, pageSize);
      if (results.length > 0) {
        setData(prev => [...prev, ...results]);
      }
      if (results.length < pageSize) {
        setHasMore(false);
      }
    } catch (error) {
      console.error(`Failed to load more ${tableName}:`, error);
    } finally {
      setLoadingMore(false);
    }
  };

  const renderTableHeader = () => (
    <View className="flex-row border-b border-gray-300 bg-gray-100 p-3">
      {columns.map(col => {
        const sortable = col.sortValue !== null && !!col.label;
        const isActive = sortKey === col.key;
        return (
          <Pressable
            key={col.key}
            style={{ width: (col.width as any) || 120, marginRight: 10 }}
            className={`flex-row items-center ${sortable ? 'active:opacity-60' : ''}`}
            onPress={() => sortable && handleHeaderPress(col)}
            disabled={!sortable}
          >
            <Text className={`font-bold text-sm ${isActive ? 'text-blue-600' : 'text-gray-700'}`}>{col.label}</Text>
            {sortable && (
              <MaterialIcons
                name={isActive ? (sortDir === 'asc' ? 'arrow-upward' : 'arrow-downward') : 'unfold-more'}
                size={13}
                color={isActive ? '#2563EB' : '#D1D5DB'}
                style={{ marginLeft: 2 }}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );

  const renderTableRow = useCallback(({ item }: { item: T }) => (
    <View className="flex-row border-b border-gray-200 bg-white p-3">
      {columns.map(col => (
        <View key={col.key} style={{ width: (col.width as any) || 120, marginRight: 10, justifyContent: 'center' }}>
          {col.render ? (
            col.render(item)
          ) : (
            <Text className="text-gray-800 text-sm" numberOfLines={2}>
              {String((item as any)[col.key] ?? '-')}
            </Text>
          )}
        </View>
      ))}
    </View>
  ), [columns]);

  const renderListOrCardItem = useCallback(({ item }: { item: T }) => {
    if (viewMode === 'card' && renderCardItem) {
      return renderCardItem(item) as any;
    }
    if (renderListItem) {
      return renderListItem(item) as any;
    }
    return renderTableRow({ item }) as any;
  }, [viewMode, renderCardItem, renderListItem, renderTableRow]);

  const renderCurrentView = () => {
    if (loading) {
      return <ActivityIndicator size="large" color="#D32F2F" className="mt-10" />;
    }

    if (displayData.length === 0) {
      return (
        <View className="items-center justify-center py-20">
          <MaterialIcons name={emptyIcon} size={64} color="#E5E7EB" />
          <Text className="text-gray-700 font-medium mt-4 text-base">{emptyMessage}</Text>
        </View>
      );
    }

    if (viewMode === 'table') {
      return (
        <ScrollView horizontal className="bg-white rounded-lg border border-gray-200" showsHorizontalScrollIndicator={true}>
          <View>
            {renderTableHeader()}
            <FlatList
              data={displayData}
              keyExtractor={(item) => item.id}
              renderItem={renderTableRow}
              showsVerticalScrollIndicator={true}
              onEndReached={fetchMoreData}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMore ? <ActivityIndicator size="small" color="#D32F2F" className="py-4" /> : null
              }
            />
          </View>
        </ScrollView>
      );
    }

    return (
      <FlatList
        data={displayData}
        keyExtractor={(item) => item.id}
        renderItem={renderListOrCardItem}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ paddingBottom: 100 }}
        onEndReached={fetchMoreData}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator size="small" color="#D32F2F" className="py-4" /> : null
        }
      />
    );
  };

  return (
    <View className="flex-1">
      <View className="flex-row justify-end mb-3">
        <View className="flex-row bg-white rounded-lg border border-gray-200 overflow-hidden">
          <Pressable
            onPress={() => setViewMode('table')}
            className={`p-2 flex-row items-center justify-center ${viewMode === 'table' ? 'bg-blue-50' : ''}`}
          >
            <MaterialIcons name="table-chart" size={20} color={viewMode === 'table' ? '#1976D2' : '#6B7280'} />
            <Text className={`ml-1 text-xs ${viewMode === 'table' ? 'text-blue-700 font-bold' : 'text-gray-500'}`}>Table</Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('list')}
            className={`p-2 border-l border-gray-200 flex-row items-center justify-center ${viewMode === 'list' ? 'bg-blue-50' : ''}`}
          >
            <MaterialIcons name="view-list" size={20} color={viewMode === 'list' ? '#1976D2' : '#6B7280'} />
            <Text className={`ml-1 text-xs ${viewMode === 'list' ? 'text-blue-700 font-bold' : 'text-gray-500'}`}>List</Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('card')}
            className={`p-2 border-l border-gray-200 flex-row items-center justify-center ${viewMode === 'card' ? 'bg-blue-50' : ''}`}
          >
            <MaterialIcons name="grid-view" size={20} color={viewMode === 'card' ? '#1976D2' : '#6B7280'} />
            <Text className={`ml-1 text-xs ${viewMode === 'card' ? 'text-blue-700 font-bold' : 'text-gray-500'}`}>Card</Text>
          </Pressable>
        </View>
      </View>
      {renderCurrentView()}
    </View>
  );
}
