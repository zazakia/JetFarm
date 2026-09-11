import * as Crypto from 'expo-crypto';

/**
 * Lightweight Encryption Service for sensitive data protection.
 * Note: In a production mobile environment, use a secure key storage (like expo-secure-store).
 * For this implementation, we use a simple XOR/Base64 approach as a placeholder for a full 
 * AES implementation if specific native modules aren't fully configured, or as a 
 * supplementary layer for obfuscation.
 */

import CryptoJS from 'crypto-js';
import { ErrorService } from "./ErrorService";

// The primary encryption key is now loaded securely from environment variables
const getAppSecret = (): string => {
    return process.env.EXPO_PUBLIC_ENCRYPTION_KEY || '';
};

const getLegacySecret = (): string => {
    return process.env.EXPO_PUBLIC_LEGACY_ENCRYPTION_KEY || '';
};

const AES_PREFIX = 'AES::v1::';

export class EncryptionService {
    /**
     * Obfuscates/Encrypts a string.
     * Truly sensitive data should be encrypted with AES on the device.
     */
    static encrypt(text: string | null | undefined): string | null {
        if (!text) return null;
        try {
            // New records use strong AES encryption with a prefix marker
            const appSecret = getAppSecret();
            if (!appSecret) {
                console.warn('[EncryptionService] EXPO_PUBLIC_ENCRYPTION_KEY is empty. Encryption aborted.');
                return null;
            }
            const encrypted = CryptoJS.AES.encrypt(text, appSecret).toString();
            return `${AES_PREFIX}${encrypted}`;
        } catch (e) {
            ErrorService.handleError(e, '[EncryptionService] Encryption failed:');
            return null;
        }
    }

    /**
     * De-obfuscates/Decrypts a string.
     * Uses Hybrid Fallback: AES for new data, XOR for legacy data.
     */
    static decrypt(encryptedText: string | null | undefined): string | null {
        if (!encryptedText) return null;

        try {
            // Smart Fallback 1: Try AES first and strip the prefix
            if (encryptedText.startsWith(AES_PREFIX)) {
                try {
                    const pureEncrypted = encryptedText.substring(AES_PREFIX.length);
                    const appSecret = getAppSecret();
                    const legacySecret = getLegacySecret();

                    if (!appSecret) {
                        console.warn('[EncryptionService] EXPO_PUBLIC_ENCRYPTION_KEY is empty. Decryption aborted.');
                        return null;
                    }

                    // Try primary key
                    let bytes = CryptoJS.AES.decrypt(pureEncrypted, appSecret);
                    let decrypted = bytes.toString(CryptoJS.enc.Utf8);
                    
                    // If decryption fails with primary key, try legacy key
                    if (!decrypted && legacySecret && appSecret !== legacySecret) {
                        bytes = CryptoJS.AES.decrypt(pureEncrypted, legacySecret);
                        decrypted = bytes.toString(CryptoJS.enc.Utf8);
                    }
                    
                    return decrypted || null;
                } catch (e) {
                    ErrorService.handleError(e, '[EncryptionService] AES Decryption failed:');
                    return null;
                }
            }

            if (encryptedText.startsWith('enc:')) {
                const base64Part = encryptedText.substring(4);
                const decoded = atob(base64Part);
                const legacySecret = getLegacySecret();
                if (!legacySecret) {
                    console.warn('[EncryptionService] EXPO_PUBLIC_LEGACY_ENCRYPTION_KEY is empty. XOR Decryption aborted.');
                    return null;
                }
                // Legacy XOR always uses the legacy secret
                return this.xor(decoded, legacySecret);
            }

            // Fallback 3: Plain text (unencrypted old records)
            return encryptedText;
        } catch (e) {
            ErrorService.handleError(e, '[EncryptionService] Decryption failed:');
            return null;
        }
    }

    private static xor(input: string, key: string): string {
        let output = '';
        for (let i = 0; i < input.length; i++) {
            const charCode = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            output += String.fromCharCode(charCode);
        }
        return output;
    }

    /**
     * Generates a hash for consistency checks (e.g. for PII hashing).
     */
    static async hash(text: string): Promise<string> {
        return await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            text
        );
    }
}
