import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { GPSCoordinate, distanceMeters, isValidCoordinate } from '../utils/coordinates';
import { DEFAULT_WALK_SETTINGS, GPSFix, isFixAccepted } from '../services/BoundaryWalkService';
import { locationProvider, LocationWatchHandle } from '../services/LocationService';

export type ParcelGpsStatus = 'idle' | 'requesting' | 'recording' | 'paused';

export interface ParcelGpsCaptureOptions {
    onCoordinate: (coordinate: GPSCoordinate) => void;
}

/** Foreground-only capture. Pausing invalidates permission requests and late stream callbacks. */
export function useParcelGpsCapture({ onCoordinate }: ParcelGpsCaptureOptions) {
    const [status, setStatus] = useState<ParcelGpsStatus>('idle');
    const [liveFix, setLiveFix] = useState<GPSFix | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const statusRef = useRef<ParcelGpsStatus>('idle');
    const generation = useRef(0);
    const mounted = useRef(true);
    const watch = useRef<LocationWatchHandle | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // A pause changes stream generation, not the continuous walk's acceptance history.
    const walkHistory = useRef<{ lastAccepted: GPSFix | null; lastTimestamp: number }>({ lastAccepted: null, lastTimestamp: 0 });
    const callback = useRef(onCoordinate);
    callback.current = onCoordinate;

    const stop = useCallback((next: ParcelGpsStatus) => {
        generation.current += 1;
        watch.current?.remove();
        watch.current = null;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        if (next === 'idle') walkHistory.current = { lastAccepted: null, lastTimestamp: 0 };
        statusRef.current = next;
        if (mounted.current) setStatus(next);
    }, []);

    const pause = useCallback(() => stop('paused'), [stop]);
    const finish = useCallback(() => stop('idle'), [stop]);

    const begin = useCallback(async (singlePoint: boolean) => {
        if (!mounted.current || statusRef.current === 'requesting' || statusRef.current === 'recording') return;
        if (singlePoint || statusRef.current !== 'paused') walkHistory.current = { lastAccepted: null, lastTimestamp: 0 };
        // One-shot capture neither inherits nor supplies a walking distance/jump baseline.
        const history = singlePoint ? { lastAccepted: null, lastTimestamp: 0 } : walkHistory.current;
        const session = ++generation.current;
        statusRef.current = 'requesting';
        setStatus('requesting');
        setFeedback(null);
        setLiveFix(null);
        const current = () => mounted.current && generation.current === session;
        try {
            const permission = await locationProvider.requestPermission();
            if (!current()) return;
            if (permission !== 'granted') {
                setFeedback(permission === 'denied'
                    ? 'Location permission is required. Enable it in device or browser settings.'
                    : 'Location is unavailable. Turn on GPS or enter coordinates manually.');
                stop('idle');
                return;
            }
            statusRef.current = 'recording';
            setStatus('recording');
            const handle = locationProvider.watchPosition((fix) => {
                if (!current()) return;
                const now = Date.now();
                if (!Number.isFinite(fix?.timestamp) || fix.timestamp < now - 15000 || fix.timestamp > now + 5000 || fix.timestamp <= history.lastTimestamp) {
                    setFeedback('Waiting for a fresh GPS position.');
                    return;
                }
                if (!fix.coordinate || !isValidCoordinate(fix.coordinate.latitude, fix.coordinate.longitude)) {
                    setFeedback('GPS returned invalid coordinates. This position was not displayed or recorded.');
                    return;
                }
                history.lastTimestamp = fix.timestamp;
                setLiveFix(fix);
                if (!isFixAccepted(fix, DEFAULT_WALK_SETTINGS)) {
                    setFeedback('Waiting for GPS accuracy within 10 m; this point was not recorded.');
                    return;
                }
                const lastAccepted = history.lastAccepted;
                if (!singlePoint && lastAccepted && distanceMeters(lastAccepted.coordinate, fix.coordinate) < DEFAULT_WALK_SETTINGS.minDistanceMeters) {
                    setFeedback('Move at least 5 m to record the next point.');
                    return;
                }
                // A walking boundary cannot jump hundreds of meters in a second.
                if (lastAccepted) {
                    const seconds = Math.max(1, (fix.timestamp - lastAccepted.timestamp) / 1000);
                    if (distanceMeters(lastAccepted.coordinate, fix.coordinate) > Math.max(30, seconds * 10)) {
                        setFeedback('GPS position jumped unexpectedly; this point was not recorded.');
                        return;
                    }
                }
                history.lastAccepted = fix;
                setFeedback(null);
                callback.current(fix.coordinate);
                if (singlePoint) stop('idle');
            }, (error) => {
                if (!current()) return;
                setFeedback(error.message || 'GPS capture failed. Resume or enter coordinates manually.');
                stop('paused');
            });
            if (!current()) handle.remove();
            else watch.current = handle;
            if (singlePoint && current()) {
                timer.current = setTimeout(() => {
                    if (!current()) return;
                    setFeedback('No accurate GPS point received. Try again outdoors or enter coordinates manually.');
                    stop('idle');
                }, 30000);
            }
        } catch (error) {
            if (!current()) return;
            setFeedback(error instanceof Error ? error.message : 'Unable to start GPS capture.');
            stop('idle');
        }
    }, [stop]);

    const start = useCallback(() => begin(false), [begin]);
    const capturePoint = useCallback(() => begin(true), [begin]);

    useEffect(() => {
        mounted.current = true;
        const pauseIfCapturing = () => {
            if (statusRef.current === 'recording' || statusRef.current === 'requesting') pause();
        };
        const listener = AppState.addEventListener('change', (state) => {
            if (state !== 'active') pauseIfCapturing();
        });
        const handleVisibility = () => {
            if (typeof document !== 'undefined' && document.hidden) pauseIfCapturing();
        };
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            mounted.current = false;
            stop('idle');
            listener.remove();
            if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [pause, stop]);

    return { status, liveFix, feedback, start, pause, finish, capturePoint };
}
