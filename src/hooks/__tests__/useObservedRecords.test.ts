import { Observable, Subject, of } from 'rxjs';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useObservedRecords } from '../useObservedRecords';

const EMPTY: string[] = [];
/**
 * Cold sources must be built once: a fresh observable per render changes the hook's dependency
 * and re-subscribes forever.
 */
const CACHED$ = of(['cached']);

describe('useObservedRecords', () => {
    it('delivers emissions as they arrive and stops loading after the first', async () => {
        const source = new Subject<string[]>();

        const { result } = renderHook(() =>
            useObservedRecords<string[]>({ records$: source, empty: EMPTY, label: 'test' }),
        );

        expect(result.current.loading).toBe(true);

        act(() => {
            source.next(['alpha']);
        });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        expect(result.current.records).toEqual(['alpha']);

        act(() => {
            source.next(['alpha', 'bravo']);
        });

        await waitFor(() => {
            expect(result.current.records).toEqual(['alpha', 'bravo']);
        });
    });

    it('reports the empty value without a stuck spinner when there is no source', async () => {
        const { result } = renderHook(() =>
            useObservedRecords<string[]>({ records$: null, empty: EMPTY, label: 'test' }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.records).toEqual([]);
    });

    it('unsubscribes from the old source when the caller swaps it', async () => {
        const first = new Subject<string[]>();
        const second = new Subject<string[]>();
        const firstTeardown = jest.fn();
        const firstWithTeardown = new Observable<string[]>((subscriber) => {
            const subscription = first.subscribe(subscriber);
            return () => {
                firstTeardown();
                subscription.unsubscribe();
            };
        });

        const { result, rerender } = renderHook(
            ({ source }: { source: Observable<string[]> }) =>
                useObservedRecords<string[]>({ records$: source, empty: EMPTY, label: 'test' }),
            { initialProps: { source: firstWithTeardown } },
        );

        act(() => {
            first.next(['from-first']);
        });
        await waitFor(() => {
            expect(result.current.records).toEqual(['from-first']);
        });

        rerender({ source: second });

        expect(firstTeardown).toHaveBeenCalledTimes(1);

        // The retired source can no longer write to the screen.
        act(() => {
            first.next(['ghost']);
        });
        expect(result.current.records).not.toContain('ghost');

        act(() => {
            second.next(['from-second']);
        });
        await waitFor(() => {
            expect(result.current.records).toEqual(['from-second']);
        });
    });

    it('stops loading and keeps the last good value when observation fails', async () => {
        const source = new Subject<string[]>();

        const { result } = renderHook(() =>
            useObservedRecords<string[]>({ records$: source, empty: EMPTY, label: 'test' }),
        );

        act(() => {
            source.next(['kept']);
        });
        await waitFor(() => {
            expect(result.current.records).toEqual(['kept']);
        });

        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        act(() => {
            source.error(new Error('loki blew up'));
        });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.records).toEqual(['kept']);
        expect(consoleError).toHaveBeenCalledWith('[test] Observation failed', expect.any(Error));
        consoleError.mockRestore();
    });

    it('hands pull-to-refresh to the caller and clears the spinner either way', async () => {
        let release: () => void = () => {};
        const onRefresh = jest.fn(
            () =>
                new Promise<void>((resolve) => {
                    release = resolve;
                }),
        );

        const { result } = renderHook(() =>
            useObservedRecords<string[]>({
                records$: CACHED$,
                empty: EMPTY,
                label: 'test',
                onRefresh,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        let pending: Promise<void> = undefined!;
        act(() => {
            pending = result.current.refresh();
        });

        // The sync task is still running, so the spinner must be up.
        expect(result.current.refreshing).toBe(true);

        await act(async () => {
            release();
            await pending;
        });

        expect(onRefresh).toHaveBeenCalledTimes(1);
        expect(result.current.refreshing).toBe(false);
    });

    it('still clears the refresh spinner when the caller task throws', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        const { result } = renderHook(() =>
            useObservedRecords<string[]>({
                records$: CACHED$,
                empty: EMPTY,
                label: 'test',
                onRefresh: () => Promise.reject(new Error('sync failed')),
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.refreshing).toBe(false);
        consoleError.mockRestore();
    });

    it('does not need a caller task to refresh', async () => {
        const { result } = renderHook(() =>
            useObservedRecords<string[]>({ records$: CACHED$, empty: EMPTY, label: 'test' }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.refreshing).toBe(false);
    });
});
