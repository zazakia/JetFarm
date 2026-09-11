import { safeBack } from '../navigation';
import { Router } from 'expo-router';

describe('navigation utility', () => {
    describe('safeBack', () => {
        let mockRouter: Partial<Router>;
        const fallback = '/(collector)';

        beforeEach(() => {
            mockRouter = {
                canGoBack: jest.fn(),
                back: jest.fn(),
                replace: jest.fn(),
            };
            jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        afterEach(() => {
            (console.warn as jest.Mock).mockRestore();
        });

        it('calls router.back() when canGoBack is true', () => {
            (mockRouter.canGoBack as jest.Mock).mockReturnValue(true);
            
            safeBack(mockRouter as Router, fallback);
            
            expect(mockRouter.back).toHaveBeenCalled();
            expect(mockRouter.replace).not.toHaveBeenCalled();
        });

        it('calls router.replace() with fallback when canGoBack is false', () => {
            (mockRouter.canGoBack as jest.Mock).mockReturnValue(false);
            
            safeBack(mockRouter as Router, fallback);
            
            expect(mockRouter.replace).toHaveBeenCalledWith(fallback);
            expect(mockRouter.back).not.toHaveBeenCalled();
            expect(console.warn).toHaveBeenCalled();
        });
    });
});
