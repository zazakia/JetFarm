import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LandingVideoPlayer } from '../LandingVideoPlayer';

describe('LandingVideoPlayer', () => {
    it('renders the video title and subtitle', () => {
        const { getByText } = render(
            <LandingVideoPlayer
                title="Custom Title"
                subtitle="Custom Subtitle"
            />
        );

        expect(getByText('Custom Title')).toBeTruthy();
        expect(getByText('Custom Subtitle')).toBeTruthy();
        expect(getByText('4:51 Min Walkthrough')).toBeTruthy();
    });

    it('renders quick mute/unmute button and handles click', () => {
        const { getByTestId, getByText } = render(
            <LandingVideoPlayer />
        );

        const muteBtn = getByTestId('video-quick-mute-toggle');
        expect(muteBtn).toBeTruthy();
        expect(getByText('Audio On')).toBeTruthy();

        // Click to mute
        fireEvent.press(muteBtn);
        expect(getByText('Unmute')).toBeTruthy();

        // Click again to unmute
        fireEvent.press(muteBtn);
        expect(getByText('Audio On')).toBeTruthy();
    });

    it('renders big play button when video is paused and toggles play state', () => {
        const { getByText, getByTestId } = render(
            <LandingVideoPlayer autoPlay={false} />
        );

        expect(getByText('Click to Play Full Overview')).toBeTruthy();

        const playToggle = getByTestId('video-overlay-play-toggle');
        expect(playToggle).toBeTruthy();

        fireEvent.press(playToggle);
        // After pressing play, user has engaged play state
        expect(getByTestId('video-overlay-fullscreen')).toBeTruthy();
    });

    it('handles seek press on progress scrubber', () => {
        const { getByTestId } = render(
            <LandingVideoPlayer />
        );

        const scrubber = getByTestId('video-scrubber');
        expect(scrubber).toBeTruthy();

        fireEvent.press(scrubber, {
            nativeEvent: { locationX: 50, target: { clientWidth: 200 } },
        });
    });
});
