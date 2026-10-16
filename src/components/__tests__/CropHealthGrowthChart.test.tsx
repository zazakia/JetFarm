import React from 'react';
import { render } from '@testing-library/react-native';
import { CropHealthGrowthChart, parseHealthScore, STAGES_METADATA } from '../CropHealthGrowthChart';

describe('CropHealthGrowthChart', () => {
    describe('parseHealthScore', () => {
        it('maps health statuses to numeric scores 1 through 5', () => {
            expect(parseHealthScore('diseased')).toBe(1);
            expect(parseHealthScore('pest_risk')).toBe(2);
            expect(parseHealthScore('fair')).toBe(3);
            expect(parseHealthScore('good')).toBe(4);
            expect(parseHealthScore('excellent')).toBe(5);
        });

        it('defaults to fair (3) if unknown status provided', () => {
            expect(parseHealthScore('unknown_status')).toBe(3);
            expect(parseHealthScore(undefined)).toBe(3);
        });
    });

    describe('STAGES_METADATA', () => {
        it('defines all 5 cassava growth stages in chronological order', () => {
            expect(STAGES_METADATA).toHaveLength(5);
            expect(STAGES_METADATA.map(s => s.id)).toEqual([
                'land_prep',
                'germination',
                'vegetative',
                'root_bulking',
                'maturity',
            ]);
        });
    });

    describe('Rendering component', () => {
        it('renders the chart container, title, and stage milestones', () => {
            const mockCheckins = [
                {
                    stage: 'land_prep',
                    healthStatus: 'good',
                    plantHeightCm: 0,
                    checkinDate: new Date('2026-01-10'),
                },
                {
                    stage: 'germination',
                    healthStatus: 'excellent',
                    plantHeightCm: 25,
                    checkinDate: new Date('2026-02-15'),
                },
                {
                    stage: 'vegetative',
                    healthStatus: 'good',
                    plantHeightCm: 85,
                    checkinDate: new Date('2026-04-10'),
                },
            ];

            const { getByText, getByTestId } = render(
                <CropHealthGrowthChart checkins={mockCheckins} currentStage="vegetative" />
            );

            expect(getByTestId('crop-health-growth-chart')).toBeTruthy();
            expect(getByText(/Crop Health Trajectory/i)).toBeTruthy();
            expect(getByText('Land Prep')).toBeTruthy();
            expect(getByText('Germination')).toBeTruthy();
            expect(getByText('Vegetative')).toBeTruthy();
            expect(getByText('Root Bulking')).toBeTruthy();
            expect(getByText('Maturity')).toBeTruthy();
        });

        it('handles empty checkin list gracefully', () => {
            const { getByTestId, getByText } = render(
                <CropHealthGrowthChart checkins={[]} />
            );

            expect(getByTestId('crop-health-growth-chart')).toBeTruthy();
            expect(getByText(/Awaiting growth stage check-ins/i)).toBeTruthy();
        });
    });
});
