import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import LoginScreen from '../login';
import { AuthService } from '../../src/services/AuthService';
import { useRouter } from 'expo-router';
import { COMPANY_EMAIL_PLACEHOLDER, COMPANY_NAME } from '../../src/constants/brand';

// Mock AuthService
jest.mock('../../src/services/AuthService', () => ({
    AuthService: {
        isQuickLoginEnabled: jest.fn().mockReturnValue(true),
        signIn: jest.fn(),
        quickSignIn: jest.fn(),
        getQuickLoginUsers: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock('../../src/services/ErrorService', () => ({
    ErrorService: {
        getUserMessage: jest.fn((error: any, fallback?: string) => {
            const message = error?.message || fallback || 'Something went wrong.';
            if (message.includes('Invalid login credentials')) {
                return 'Email or password is incorrect. Please check your credentials and try again.';
            }
            if (message.includes('Email not confirmed')) {
                return 'Your email is not verified yet. Please contact an administrator for approval.';
            }
            return message;
        }),
    },
}));

jest.mock('../../src/services/InquiryService', () => ({
    DEMO_ADMIN_CONTACT: {
        email: 'cybergada@gmail.com',
        whatsappDisplay: '09811254446',
        whatsappInternational: '639811254446',
    },
    InquiryService: {
        submitDemoInquiry: jest.fn().mockResolvedValue({
            fullName: 'Juan Client',
            businessName: 'Juan Lending',
            contactNumber: '09171234567',
            email: 'client@example.com',
            message: 'Interested',
        }),
        buildAdminNotificationLinks: jest.fn().mockReturnValue({
            whatsappUrl: 'https://wa.me/639811254446?text=New%20AGAP%20MICRO-LENDING%20CORP.%20demo%20inquiry',
            mailtoUrl: 'mailto:cybergada@gmail.com?subject=New%20AGAP%20MICRO-LENDING%20CORP.%20Demo%20Inquiry',
        }),
    },
}));

// Mock expo-router
jest.mock('expo-router', () => ({
    useRouter: jest.fn(),
}));

// Mock icons
jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
    Ionicons: () => null,
}));

describe('LoginScreen', () => {
    const mockReplace = jest.fn();
    const mockPush = jest.fn();
    let openUrlSpy: jest.SpyInstance;
    const { InquiryService } = require('../../src/services/InquiryService');

    beforeEach(() => {
        jest.clearAllMocks();
        openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, push: mockPush });
        (AuthService.isQuickLoginEnabled as jest.Mock).mockReturnValue(true);
        (AuthService.getQuickLoginUsers as jest.Mock).mockResolvedValue([]);
        InquiryService.submitDemoInquiry.mockResolvedValue({
            fullName: 'Juan Client',
            businessName: 'Juan Lending',
            contactNumber: '09171234567',
            email: 'client@example.com',
            message: 'Interested',
        });
        InquiryService.buildAdminNotificationLinks.mockReturnValue({
            whatsappUrl: `https://wa.me/639811254446?text=New%20${encodeURIComponent(COMPANY_NAME)}%20demo%20inquiry`,
            mailtoUrl: `mailto:cybergada@gmail.com?subject=New%20${encodeURIComponent(COMPANY_NAME)}%20Demo%20Inquiry`,
        });
    });

    afterEach(() => {
        openUrlSpy.mockRestore();
    });

    it('renders correctly', async () => {
        render(<LoginScreen />);
        
        // Wait for useEffect state updates to finish
        await waitFor(() => {
            expect(AuthService.getQuickLoginUsers).toHaveBeenCalled();
        });

        expect(screen.getByPlaceholderText(COMPANY_EMAIL_PLACEHOLDER)).toBeTruthy();
        expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
        expect(screen.getByText(/SIGN IN/i)).toBeTruthy();
    });

    it('renders marketing landing content without blocking login', async () => {
        render(<LoginScreen />);

        await waitFor(() => {
            expect(AuthService.getQuickLoginUsers).toHaveBeenCalled();
        });

        expect(screen.getByText(/POS Cursor CSCC is likened to the rays of the sun/i)).toBeTruthy();
        expect(screen.getByText(/Our Mission/i)).toBeTruthy();
        expect(screen.getByText(/Our Goals/i)).toBeTruthy();
        expect(screen.getByText(/Offline-ready/i)).toBeTruthy();
        expect(screen.getByText(/Printable reports/i)).toBeTruthy();
        expect(screen.getByText(/Role-based access/i)).toBeTruthy();
        expect(screen.getByPlaceholderText(COMPANY_EMAIL_PLACEHOLDER)).toBeTruthy();
    });

    it('exposes landing CTAs for demo and account login', async () => {
        render(<LoginScreen />);

        await waitFor(() => {
            expect(AuthService.getQuickLoginUsers).toHaveBeenCalled();
        });

        expect(screen.getByTestId('landing-request-demo')).toBeTruthy();
        expect(screen.getByTestId('landing-whatsapp-demo')).toBeTruthy();
        expect(screen.getByTestId('landing-login-cta')).toBeTruthy();
    });

    it('opens demo request contact channels', async () => {
        render(<LoginScreen />);

        await waitFor(() => {
            expect(AuthService.getQuickLoginUsers).toHaveBeenCalled();
        });

        fireEvent.press(screen.getByTestId('landing-request-demo'));
        expect(openUrlSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:cybergada@gmail.com'));
        expect(openUrlSpy).toHaveBeenCalledWith(expect.stringContaining(`${encodeURIComponent(COMPANY_NAME)}%20Demo%20Request`));

        fireEvent.press(screen.getByTestId('landing-whatsapp-demo'));
        expect(openUrlSpy).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/639811254446'));
    });



    it('handles successful login', async () => {
        (AuthService.quickSignIn as jest.Mock).mockResolvedValue({ user: { id: '123' }, error: null });
        
        render(<LoginScreen />);
        
        fireEvent.changeText(screen.getByPlaceholderText(COMPANY_EMAIL_PLACEHOLDER), 'test@example.com');
        fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'password123');
        
        fireEvent.press(screen.getByText(/SIGN IN/i));

        await waitFor(() => {
            expect(AuthService.quickSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
        });
        expect(mockReplace).toHaveBeenCalledWith('/loading');
    });

    it('shows error on empty fields', async () => {
        render(<LoginScreen />);
        fireEvent.press(screen.getByText(/SIGN IN/i));
        expect(await screen.findByText(/Please enter both email and password/i)).toBeTruthy();
    });

    it('shows error on login failure', async () => {
        (AuthService.quickSignIn as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));
        
        render(<LoginScreen />);
        
        fireEvent.changeText(screen.getByPlaceholderText(COMPANY_EMAIL_PLACEHOLDER), 'test@example.com');
        fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'password123');
        fireEvent.press(screen.getByText(/SIGN IN/i));

        expect(await screen.findByText(/Invalid credentials/i)).toBeTruthy();
    });

    it('loads and displays quick login users', async () => {
        const mockUsers = [
            { id: '1', full_name: 'Admin User', role: 'admin', email: 'admin@poscursor.com' },
            { id: '2', full_name: 'Collector User', role: 'collector', email: 'collector@poscursor.com' }
        ];
        (AuthService.getQuickLoginUsers as jest.Mock).mockResolvedValue(mockUsers);

        render(<LoginScreen />);

        expect(await screen.findByText('Admin User')).toBeTruthy();
        expect(screen.getByText('Collector User')).toBeTruthy();
        expect(screen.getByText('admin@poscursor.com')).toBeTruthy();
    });

    it('handles quick login correctly', async () => {
        const mockUsers = [{ id: 'mock-admin', full_name: 'Admin User', role: 'admin', email: 'admin@poscursor.com' }];
        (AuthService.getQuickLoginUsers as jest.Mock).mockResolvedValue(mockUsers);
        (AuthService.quickSignIn as jest.Mock).mockResolvedValue({});

        render(<LoginScreen />);

        // Wait for dynamic users to lead to filtering of hardcoded ones
        await waitFor(() => {
            expect(AuthService.getQuickLoginUsers).toHaveBeenCalled();
        });

        const quickLoginBtn = await screen.findByTestId('quick-login-admin@poscursor.com');
        fireEvent.press(quickLoginBtn);

        await waitFor(() => {
            expect(AuthService.quickSignIn).toHaveBeenCalledWith('admin@poscursor.com', '12345678');
        }, { timeout: 2000 });
        expect(mockReplace).toHaveBeenCalledWith('/loading');
    });

    it('handles cybergada quick login correctly', async () => {
        const mockUsers = [{ id: 'cybergada-mock', full_name: 'Main Dev (Cybergada)', role: 'admin', email: 'cybergada@gmail.com' }];
        (AuthService.getQuickLoginUsers as jest.Mock).mockResolvedValue(mockUsers);
        (AuthService.quickSignIn as jest.Mock).mockResolvedValue({});

        render(<LoginScreen />);

        await waitFor(() => {
            expect(AuthService.getQuickLoginUsers).toHaveBeenCalled();
        });

        const quickLoginBtn = await screen.findByTestId('quick-login-cybergada@gmail.com');
        fireEvent.press(quickLoginBtn);

        await waitFor(() => {
            expect(AuthService.quickSignIn).toHaveBeenCalledWith('cybergada@gmail.com', '12345678');
        }, { timeout: 2000 });
        expect(mockReplace).toHaveBeenCalledWith('/loading');
    });

    it('handles quick login failure', async () => {
        const mockUsers = [{ id: 'mock-admin-fail', full_name: 'Admin User', role: 'admin', email: 'admin@poscursor.com' }];
        (AuthService.getQuickLoginUsers as jest.Mock).mockResolvedValue(mockUsers);
        (AuthService.quickSignIn as jest.Mock).mockRejectedValue(new Error('Quick fail'));

        render(<LoginScreen />);

        await waitFor(() => {
            expect(AuthService.getQuickLoginUsers).toHaveBeenCalled();
        });

        const quickLoginBtn = await screen.findByTestId('quick-login-admin@poscursor.com');
        fireEvent.press(quickLoginBtn);

        expect(await screen.findByText(/Quick fail/i)).toBeTruthy();
    });

    it('handles quick users load failure gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        (AuthService.getQuickLoginUsers as jest.Mock).mockRejectedValue(new Error('Network error'));

        render(<LoginScreen />);

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
        });
        consoleSpy.mockRestore();
    });

    it('does not load or render quick login when disabled', async () => {
        (AuthService.isQuickLoginEnabled as jest.Mock).mockReturnValue(false);

        render(<LoginScreen />);

        await waitFor(() => {
            expect(screen.getByText(/SIGN IN/i)).toBeTruthy();
        });

        expect(AuthService.getQuickLoginUsers).not.toHaveBeenCalled();
        expect(screen.queryByText(/Quick Access/i)).toBeNull();
    });

    it('shows specific error for unconfirmed email', async () => {
        (AuthService.quickSignIn as jest.Mock).mockRejectedValue(new Error('Auth error: Email not confirmed'));
        
        render(<LoginScreen />);
        
        fireEvent.changeText(screen.getByPlaceholderText(COMPANY_EMAIL_PLACEHOLDER), 'test@example.com');
        fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'password123');
        fireEvent.press(screen.getByText(/SIGN IN/i));

        expect(await screen.findByText(/Your email is not verified yet. Please contact an administrator for approval/i)).toBeTruthy();
    });

    it('shows friendly message for invalid credentials', async () => {
        (AuthService.quickSignIn as jest.Mock).mockRejectedValue(new Error('Invalid login credentials'));

        render(<LoginScreen />);

        fireEvent.changeText(screen.getByPlaceholderText(COMPANY_EMAIL_PLACEHOLDER), 'test@example.com');
        fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'wrong');
        fireEvent.press(screen.getByText(/SIGN IN/i));

        expect(await screen.findByText(/Email or password is incorrect/i)).toBeTruthy();
    });

    it('toggles password visibility', async () => {
        render(<LoginScreen />);
        await waitFor(() => {
            expect(AuthService.getQuickLoginUsers).toHaveBeenCalled();
        });

        const passwordInput = screen.getByPlaceholderText('••••••••');
        
        // Initial state is secure
        expect(passwordInput.props.secureTextEntry).toBe(true);

        const toggleBtn = screen.getByTestId('password-toggle');
        fireEvent.press(toggleBtn);

        expect(passwordInput.props.secureTextEntry).toBe(false);
    });

    it('navigates to register when register now is pressed', async () => {
        render(<LoginScreen />);
        await waitFor(() => {
            expect(AuthService.getQuickLoginUsers).toHaveBeenCalled();
        });

        fireEvent.press(screen.getByText(/Register Now/i));
        const mockRouter = require('expo-router').useRouter();
        expect(mockRouter.push).toHaveBeenCalledWith('/register');
    });
});

