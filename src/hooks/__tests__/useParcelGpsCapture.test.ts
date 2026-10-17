import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useParcelGpsCapture } from '../useParcelGpsCapture';
import { GPSFix } from '../../services/BoundaryWalkService';

const mockRemove = jest.fn();
let mockOnFix: (fix: GPSFix) => void;
let mockOnError: (error: Error) => void;
const mockPermission = jest.fn();
const mockWatch = jest.fn();
jest.mock('../../services/LocationService', () => ({
    locationProvider: {
        requestPermission: (...args: unknown[]) => mockPermission(...args),
        watchPosition: (...args: unknown[]) => mockWatch(...args),
    },
}));

let fixTimestamp = 1700000000000;
const fix = (delta = 0, accuracyMeters: number | null = 4): GPSFix => ({
    coordinate: { latitude: 8 + delta, longitude: 125 },
    accuracyMeters,
    timestamp: ++fixTimestamp,
});

describe('useParcelGpsCapture', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(1700000000000);
        fixTimestamp = Date.now();
        mockPermission.mockResolvedValue('granted');
        mockWatch.mockImplementation((onFix, onError) => {
            mockOnFix = onFix;
            mockOnError = onError;
            return { remove: mockRemove };
        });
    });

    afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

    it('cleans up a one-shot watcher after timeout', async () => {
        const onCoordinate = jest.fn();
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate }));
        await act(async () => { await result.current.capturePoint(); });
        act(() => jest.advanceTimersByTime(30000));
        expect(result.current.status).toBe('idle');
        expect(result.current.feedback).toContain('No accurate GPS');
        expect(mockRemove).toHaveBeenCalledTimes(1);
        act(() => mockOnFix(fix()));
        expect(onCoordinate).not.toHaveBeenCalled();
    });

    it('cleans up a watcher which delivers a synchronous single-point callback', async () => {
        const onCoordinate = jest.fn();
        mockWatch.mockImplementation(onFix => { onFix(fix()); return { remove: mockRemove }; });
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate }));
        await act(async () => { await result.current.capturePoint(); });
        expect(onCoordinate).toHaveBeenCalledTimes(1);
        expect(mockRemove).toHaveBeenCalledTimes(1);
        expect(result.current.status).toBe('idle');
        act(() => jest.advanceTimersByTime(30000));
        expect(result.current.feedback).toBeNull();
        expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it('does not start a watcher after unmount during a permission request', async () => {
        let resolvePermission!: (value: string) => void;
        mockPermission.mockImplementation(() => new Promise(resolve => { resolvePermission = resolve; }));
        const { result, unmount } = renderHook(() => useParcelGpsCapture({ onCoordinate: jest.fn() }));
        let pending!: Promise<void>;
        act(() => { pending = result.current.start(); });
        unmount();
        await act(async () => { resolvePermission('granted'); await pending; });
        expect(mockWatch).not.toHaveBeenCalled();
    });

    it('records fresh accurate fixes and pauses without accepting late fixes', async () => {
        const onCoordinate = jest.fn();
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate }));
        await act(async () => { await result.current.start(); });
        expect(result.current.status).toBe('recording');
        act(() => mockOnFix(fix()));
        expect(onCoordinate).toHaveBeenCalledWith({ latitude: 8, longitude: 125 });
        act(() => result.current.pause());
        expect(result.current.status).toBe('paused');
        act(() => mockOnFix(fix(0.001)));
        expect(onCoordinate).toHaveBeenCalledTimes(1);
        expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it('does not append a stationary fresh fix after resume, but records genuine movement', async () => {
        const onCoordinate = jest.fn();
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate }));
        await act(async () => { await result.current.start(); });
        act(() => mockOnFix(fix()));
        const oldStream = mockOnFix;
        act(() => result.current.pause());
        act(() => jest.advanceTimersByTime(20000));
        fixTimestamp = Date.now();
        await act(async () => { await result.current.start(); });
        act(() => oldStream(fix(0.0001)));
        expect(onCoordinate).toHaveBeenCalledTimes(1);
        const stationary = fix();
        act(() => mockOnFix(stationary));
        expect(result.current.liveFix).toEqual(stationary);
        expect(onCoordinate).toHaveBeenCalledTimes(1);
        expect(result.current.feedback).toContain('Move at least 5 m');
        act(() => mockOnFix(fix(0.0001)));
        expect(onCoordinate).toHaveBeenCalledTimes(2);
        expect(onCoordinate).toHaveBeenLastCalledWith({ latitude: 8.0001, longitude: 125 });
    });

    it('retains jump rejection across pause and resume', async () => {
        const onCoordinate = jest.fn();
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate }));
        await act(async () => { await result.current.start(); });
        act(() => mockOnFix(fix()));
        act(() => result.current.pause());
        await act(async () => { await result.current.start(); });
        act(() => mockOnFix(fix(0.01)));
        expect(result.current.feedback).toContain('jumped unexpectedly');
        expect(onCoordinate).toHaveBeenCalledTimes(1);
        act(() => mockOnFix(fix(0.0001)));
        expect(onCoordinate).toHaveBeenCalledTimes(2);
    });

    it('retains timestamp ordering across resume, including valid fixes rejected for accuracy', async () => {
        const onCoordinate = jest.fn();
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate }));
        await act(async () => { await result.current.start(); });
        act(() => mockOnFix(fix()));
        const poor = fix(0.0001, 30);
        act(() => mockOnFix(poor));
        act(() => result.current.pause());
        await act(async () => { await result.current.start(); });
        act(() => mockOnFix({ ...poor, accuracyMeters: 4 }));
        expect(onCoordinate).toHaveBeenCalledTimes(1);
        expect(result.current.feedback).toContain('fresh GPS');
        act(() => mockOnFix(fix(0.0001)));
        expect(onCoordinate).toHaveBeenCalledTimes(2);
    });

    it.each([0, 0.01])('resets fix history on finish then a new walk at delta %s', async delta => {
        const onCoordinate = jest.fn();
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate }));
        await act(async () => { await result.current.start(); });
        const first = fix();
        act(() => mockOnFix(first));
        act(() => result.current.pause());
        act(() => result.current.finish());
        await act(async () => { await result.current.start(); });
        // A new walk resets timestamp, spacing and jump history (the fix is still fresh).
        act(() => mockOnFix({ ...fix(delta), timestamp: first.timestamp }));
        expect(onCoordinate).toHaveBeenCalledTimes(2);
        expect(result.current.feedback).toBeNull();
    });

    it('keeps one-shot capture independent of paused walking history and the following new walk', async () => {
        const onCoordinate = jest.fn();
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate }));
        await act(async () => { await result.current.start(); });
        act(() => mockOnFix(fix()));
        act(() => result.current.pause());
        await act(async () => { await result.current.capturePoint(); });
        act(() => mockOnFix(fix(0.01)));
        expect(onCoordinate).toHaveBeenCalledTimes(2);
        expect(result.current.status).toBe('idle');
        await act(async () => { await result.current.start(); });
        act(() => mockOnFix(fix(0.01)));
        expect(onCoordinate).toHaveBeenCalledTimes(3);
    });

    it('rejects poor, unknown, stale and out-of-order fixes with visible feedback', async () => {
        const onCoordinate = jest.fn();
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate }));
        await act(async () => { await result.current.start(); });
        act(() => mockOnFix(fix(0, 30)));
        expect(result.current.feedback).toContain('accuracy');
        act(() => mockOnFix(fix(0, null)));
        act(() => mockOnFix({ ...fix(), timestamp: Date.now() - 60000 }));
        expect(onCoordinate).not.toHaveBeenCalled();
        const accepted = fix();
        act(() => mockOnFix(accepted));
        act(() => mockOnFix({ ...fix(0.001), timestamp: accepted.timestamp - 1 }));
        expect(onCoordinate).toHaveBeenCalledTimes(1);
    });

    it('never exposes malformed coordinates to the live map, even with a fresh timestamp', async () => {
        const onCoordinate = jest.fn();
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate }));
        await act(async () => { await result.current.start(); });
        act(() => mockOnFix({ ...fix(), coordinate: { latitude: NaN, longitude: 125 } }));
        expect(result.current.liveFix).toBeNull();
        expect(onCoordinate).not.toHaveBeenCalled();
        act(() => mockOnFix(fix(0, null)));
        expect(result.current.liveFix?.coordinate.latitude).toBe(8);
        expect(result.current.feedback).toContain('accuracy');
    });

    it('does not start a watcher after pausing a pending permission request', async () => {
        let resolvePermission!: (value: string) => void;
        mockPermission.mockImplementation(() => new Promise(resolve => { resolvePermission = resolve; }));
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate: jest.fn() }));
        let pending!: Promise<void>;
        act(() => { pending = result.current.start(); });
        act(() => result.current.pause());
        await act(async () => { resolvePermission('granted'); await pending; });
        expect(mockWatch).not.toHaveBeenCalled();
        expect(result.current.status).toBe('paused');
    });

    it('prevents simultaneous start requests and cleans up on unmount', async () => {
        const { result, unmount } = renderHook(() => useParcelGpsCapture({ onCoordinate: jest.fn() }));
        await act(async () => { await Promise.all([result.current.start(), result.current.start()]); });
        expect(mockWatch).toHaveBeenCalledTimes(1);
        unmount();
        expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it('records one current point and immediately removes its watcher', async () => {
        const onCoordinate = jest.fn();
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate }));
        await act(async () => { await result.current.capturePoint(); });
        act(() => mockOnFix(fix()));
        expect(onCoordinate).toHaveBeenCalledTimes(1);
        expect(result.current.status).toBe('idle');
        expect(mockRemove).toHaveBeenCalledTimes(1);
        act(() => mockOnFix(fix(0.001)));
        expect(onCoordinate).toHaveBeenCalledTimes(1);
    });

    it('shows permission and stream errors without leaving recording active', async () => {
        mockPermission.mockResolvedValueOnce('denied');
        const { result } = renderHook(() => useParcelGpsCapture({ onCoordinate: jest.fn() }));
        await act(async () => { await result.current.start(); });
        expect(result.current.feedback).toContain('permission');
        expect(result.current.status).toBe('idle');
        await act(async () => { await result.current.start(); });
        act(() => mockOnError(new Error('GPS signal lost')));
        expect(result.current.feedback).toContain('GPS signal lost');
        expect(result.current.status).toBe('paused');
        expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it('pauses when the app moves to the background', async () => {
        let onState: (state: string) => void = () => {};
        const removeListener = jest.fn();
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener: any) => {
            onState = listener;
            return { remove: removeListener };
        });
        const { result, unmount } = renderHook(() => useParcelGpsCapture({ onCoordinate: jest.fn() }));
        await act(async () => { await result.current.start(); });
        act(() => onState('background'));
        expect(result.current.status).toBe('paused');
        expect(mockRemove).toHaveBeenCalledTimes(1);
        unmount();
        expect(removeListener).toHaveBeenCalledTimes(1);
        jest.restoreAllMocks();
    });
});
