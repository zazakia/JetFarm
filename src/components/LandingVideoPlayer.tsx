import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    Platform,
    Image,
    AppState,
    AppStateStatus,
    Pressable,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { AnimatedPressable } from './AnimatedPressable';

interface LandingVideoPlayerProps {
    videoSrc?: string;
    posterSrc?: string;
    title?: string;
    subtitle?: string;
    autoPlay?: boolean;
    autoPlaySound?: boolean;
}

function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function LandingVideoPlayer({
    videoSrc = '/videos/jetfarms.mp4',
    posterSrc = '/videos/jetfarms-poster.jpg',
    title = 'Agri-One Agribusiness & Field Operations Showcase',
    subtitle = 'See real-time crop cycle tracking, offline GPS parcel mapping, Pakyaw labor payroll, and weighbridge harvest intake in action.',
    autoPlay = true,
    autoPlaySound = true,
}: LandingVideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<any>(null);

    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isMuted, setIsMuted] = useState(!autoPlaySound);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isInView, setIsInView] = useState(false);
    const [isUserPaused, setIsUserPaused] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const hideControlsTimeoutRef = useRef<any>(null);

    // Auto-hide controls when playing and inactive
    const resetControlsTimeout = useCallback(() => {
        setShowControls(true);
        if (hideControlsTimeoutRef.current) {
            clearTimeout(hideControlsTimeoutRef.current);
        }
        if (isPlaying) {
            hideControlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3500);
        }
    }, [isPlaying]);

    // Handle Play / Pause safely
    const playVideo = useCallback(() => {
        setIsPlaying(true);
        if (!videoRef.current) return;
        videoRef.current.muted = isMuted;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    setIsPlaying(true);
                })
                .catch(() => {
                    // Autoplay with audio was blocked; force mute and retry
                    if (videoRef.current) {
                        videoRef.current.muted = true;
                        setIsMuted(true);
                        videoRef.current
                            .play()
                            .then(() => setIsPlaying(true))
                            .catch(() => {});
                    }
                });
        }
    }, [isMuted]);

    const pauseVideo = useCallback(() => {
        setIsPlaying(false);
        if (!videoRef.current) return;
        videoRef.current.pause();
    }, []);

    // Manual Toggle by User
    const handleTogglePlay = useCallback(() => {
        if (isPlaying) {
            pauseVideo();
            setIsUserPaused(true);
        } else {
            setIsUserPaused(false);
            if (videoRef.current) {
                videoRef.current.muted = isMuted;
            }
            playVideo();
        }
        resetControlsTimeout();
    }, [isPlaying, isMuted, pauseVideo, playVideo, resetControlsTimeout]);

    // Toggle Mute
    const handleToggleMute = useCallback(() => {
        setIsMuted((prev) => {
            const next = !prev;
            if (videoRef.current) {
                videoRef.current.muted = next;
                if (!next) {
                    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                }
            }
            return next;
        });
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    // Fullscreen toggle
    const handleFullscreen = useCallback(() => {
        if (!videoRef.current) return;
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else {
            const el = containerRef.current || videoRef.current;
            if (el && el.requestFullscreen) {
                el.requestFullscreen().catch(() => {});
            } else if (videoRef.current && (videoRef.current as any).webkitRequestFullscreen) {
                (videoRef.current as any).webkitRequestFullscreen();
            }
        }
    }, []);

    // Seek / Scrubber click
    const handleSeek = useCallback((e: any) => {
        if (!videoRef.current || !duration) return;
        const nativeEvent = e.nativeEvent;
        // Support both web mouse event and touch location
        const targetWidth = nativeEvent?.target?.clientWidth || 300;
        const clickX = nativeEvent?.locationX ?? nativeEvent?.offsetX ?? 0;
        const ratio = Math.max(0, Math.min(1, clickX / targetWidth));
        const targetTime = ratio * duration;
        videoRef.current.currentTime = targetTime;
        setCurrentTime(targetTime);
    }, [duration]);

    // Immediate Autoplay on Mount: attempts audio playback and registers first-gesture unmuter
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;

        const video = videoRef.current;
        if (!video) return;

        if (autoPlay) {
            video.muted = isMuted;
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        setIsPlaying(true);
                    })
                    .catch(() => {
                        // Browser policy blocked unmuted autoplay: fall back to muted first
                        if (videoRef.current) {
                            videoRef.current.muted = true;
                            setIsMuted(true);
                            videoRef.current
                                .play()
                                .then(() => setIsPlaying(true))
                                .catch(() => {});
                        }
                    });
            }
        }

        // When autoplay sound is enabled, automatically unmute upon the first user interaction anywhere
        if (autoPlaySound) {
            const handleFirstGesture = () => {
                if (videoRef.current && videoRef.current.muted) {
                    videoRef.current.muted = false;
                    setIsMuted(false);
                    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                }
                window.removeEventListener('click', handleFirstGesture);
                window.removeEventListener('touchstart', handleFirstGesture);
                window.removeEventListener('keydown', handleFirstGesture);
            };

            window.addEventListener('click', handleFirstGesture, { once: true });
            window.addEventListener('touchstart', handleFirstGesture, { once: true });
            window.addEventListener('keydown', handleFirstGesture, { once: true });

            return () => {
                window.removeEventListener('click', handleFirstGesture);
                window.removeEventListener('touchstart', handleFirstGesture);
                window.removeEventListener('keydown', handleFirstGesture);
            };
        }
    }, [autoPlay, autoPlaySound]);

    // IntersectionObserver: Autoplay when in view, stop when out of view
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof IntersectionObserver === 'undefined') return;

        const target = containerRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                const inView = entry.isIntersecting && entry.intersectionRatio >= 0.25;
                setIsInView(inView);

                if (inView) {
                    // Scrolled into view: autoplay if user has not explicitly paused it
                    if (!isUserPaused && document.visibilityState === 'visible') {
                        playVideo();
                    }
                } else {
                    // Scrolled out of view: automatically stop / pause video
                    pauseVideo();
                }
            },
            {
                threshold: [0, 0.25, 0.5, 0.75, 1.0],
            }
        );

        observer.observe(target);

        return () => {
            observer.disconnect();
        };
    }, [isUserPaused, playVideo, pauseVideo]);

    // VisibilityChange: Pause when tab is switched/minimized, resume when visible & in view
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                pauseVideo();
            } else if (document.visibilityState === 'visible') {
                if (isInView && !isUserPaused) {
                    playVideo();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isInView, isUserPaused, playVideo, pauseVideo]);

    // AppState Listener (for mobile / React Native backgrounding)
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState !== 'active') {
                pauseVideo();
            } else if (isInView && !isUserPaused) {
                playVideo();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, [isInView, isUserPaused, playVideo, pauseVideo]);

    // Cleanup when component unmounts
    useEffect(() => {
        return () => {
            if (videoRef.current) {
                videoRef.current.pause();
            }
            if (hideControlsTimeoutRef.current) {
                clearTimeout(hideControlsTimeoutRef.current);
            }
        };
    }, []);

    // Update time & duration from HTML5 video events
    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleVideoEnded = () => {
        setIsPlaying(false);
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            if (isInView && !isUserPaused) {
                playVideo();
            }
        }
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <View
            ref={containerRef}
            className="w-full bg-slate-900/80 border border-slate-700/60 rounded-3xl overflow-hidden mb-6 shadow-2xl"
            {...(Platform.OS === 'web' ? { onPointerMove: resetControlsTimeout } : {})}
        >
            {/* Header info bar */}
            <View className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/40 flex-row items-center justify-between">
                <View className="flex-1 mr-3">
                    <View className="flex-row items-center space-x-2 mb-1">
                        <View className="flex-row items-center bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2.5 py-0.5 mr-2">
                            <View className={`w-2 h-2 rounded-full mr-1.5 ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                            <Text className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                {isPlaying ? (isMuted ? 'Auto-Playing (Muted)' : 'Playing with Audio') : isInView ? 'Ready' : 'Paused Off Screen'}
                            </Text>
                        </View>
                        <Text className="text-slate-400 text-xs font-semibold">4:51 Min Walkthrough</Text>
                    </View>
                    <Text className="text-white text-base sm:text-lg font-black tracking-tight" numberOfLines={1}>
                        {title}
                    </Text>
                    <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>
                        {subtitle}
                    </Text>
                </View>

                {/* Sound toggle quick action */}
                <AnimatedPressable
                    testID="video-quick-mute-toggle"
                    onPress={handleToggleMute}
                    className={`flex-row items-center px-3 py-1.5 rounded-xl border ${
                        isMuted
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-emerald-500/15 border-emerald-500/40'
                    }`}
                >
                    <Ionicons
                        name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'}
                        size={16}
                        color={isMuted ? '#FBBF24' : '#34D399'}
                    />
                    <Text
                        className={`text-[11px] font-bold uppercase tracking-wider ml-1.5 ${
                            isMuted ? 'text-amber-300' : 'text-emerald-300'
                        }`}
                    >
                        {isMuted ? 'Unmute' : 'Audio On'}
                    </Text>
                </AnimatedPressable>
            </View>

            {/* Video Container */}
            <View className="relative w-full aspect-video bg-black items-center justify-center overflow-hidden">
                {Platform.OS === 'web' ? (
                    <video
                        ref={videoRef}
                        src={videoSrc}
                        poster={posterSrc}
                        playsInline
                        autoPlay={autoPlay}
                        muted={isMuted}
                        loop
                        preload="auto"
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={handleVideoEnded}
                        onClick={handleTogglePlay}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                            cursor: 'pointer',
                        }}
                    />
                ) : (
                    // Native Fallback View
                    <View className="w-full h-full relative">
                        <Image
                            source={{ uri: posterSrc }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                        <View className="absolute inset-0 bg-black/40 items-center justify-center">
                            <View className="w-16 h-16 rounded-full bg-emerald-600/90 items-center justify-center border border-white/20">
                                <Ionicons name="play" size={30} color="#fff" />
                            </View>
                        </View>
                    </View>
                )}

                {/* Floating Big Play Button Overlay (when paused) */}
                {!isPlaying && (
                    <Pressable
                        onPress={handleTogglePlay}
                        className="absolute inset-0 bg-black/40 items-center justify-center"
                    >
                        <View className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-emerald-600/95 items-center justify-center shadow-2xl border-2 border-emerald-300/40">
                            <Ionicons name="play" size={36} color="#ffffff" style={{ marginLeft: 4 }} />
                        </View>
                        <Text className="text-white text-xs font-black uppercase tracking-widest mt-3 bg-black/70 px-3 py-1 rounded-full border border-white/10">
                            Click to Play Full Overview
                        </Text>
                    </Pressable>
                )}

                {/* Bottom Custom Overlay Controls (Visible on hover or when paused) */}
                {(showControls || !isPlaying) && (
                    <View className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                        {/* Progress Scrubber */}
                        <Pressable
                            testID="video-scrubber"
                            onPress={handleSeek}
                            style={{
                                width: '100%',
                                height: 6,
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                borderRadius: 3,
                                marginBottom: 10,
                                overflow: 'hidden',
                            }}
                        >
                            <View
                                style={{
                                    width: `${progressPercent}%`,
                                    height: '100%',
                                    backgroundColor: '#10B981',
                                    borderRadius: 3,
                                }}
                            />
                        </Pressable>

                        <View className="flex-row items-center justify-between">
                            {/* Left: Play/Pause and Time */}
                            <View className="flex-row items-center space-x-3">
                                <AnimatedPressable
                                    testID="video-overlay-play-toggle"
                                    onPress={handleTogglePlay}
                                    className="w-9 h-9 rounded-xl bg-white/10 items-center justify-center border border-white/15"
                                >
                                    <Ionicons
                                        name={isPlaying ? 'pause' : 'play'}
                                        size={18}
                                        color="#fff"
                                    />
                                </AnimatedPressable>

                                <AnimatedPressable
                                    testID="video-overlay-sound-toggle"
                                    onPress={handleToggleMute}
                                    className="w-9 h-9 rounded-xl bg-white/10 items-center justify-center border border-white/15"
                                >
                                    <Ionicons
                                        name={isMuted ? 'volume-mute' : 'volume-high'}
                                        size={18}
                                        color={isMuted ? '#FBBF24' : '#34D399'}
                                    />
                                </AnimatedPressable>

                                <Text className="text-white text-xs font-mono font-bold tracking-tight">
                                    {formatTime(currentTime)} / {formatTime(duration || 291)}
                                </Text>
                            </View>

                            {/* Right: Fullscreen */}
                            <View className="flex-row items-center space-x-2">
                                <AnimatedPressable
                                    testID="video-overlay-fullscreen"
                                    onPress={handleFullscreen}
                                    className="w-9 h-9 rounded-xl bg-white/10 items-center justify-center border border-white/15"
                                >
                                    <MaterialIcons name="fullscreen" size={22} color="#fff" />
                                </AnimatedPressable>
                            </View>
                        </View>
                    </View>
                )}
            </View>

            {/* Bottom Highlights Strip */}
            <View className="px-4 py-3 bg-slate-950/70 border-t border-slate-800/80 flex-row flex-wrap items-center justify-between gap-2">
                <View className="flex-row items-center space-x-2">
                    <Ionicons name="sparkles" size={14} color="#34D399" />
                    <Text className="text-slate-300 text-xs font-semibold">
                        Autoplays seamlessly when scrolled into view. Automatically pauses when out of view or tab is hidden.
                    </Text>
                </View>
                <View className="flex-row items-center space-x-3">
                    <View className="flex-row items-center">
                        <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
                        <Text className="text-slate-400 text-[11px] font-bold">100% Offline Ready</Text>
                    </View>
                    <View className="flex-row items-center">
                        <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
                        <Text className="text-slate-400 text-[11px] font-bold">Field-to-Ledger Sync</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}
