// ────────────────────────────────────────────────────────────
// Token Encryption — AES-256-GCM
// ────────────────────────────────────────────────────────────
//
// Encrypts/decrypts OAuth access tokens before storing in DB.
// Format: iv:authTag:ciphertext  (all base64)
// ────────────────────────────────────────────────────────────

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
    const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        throw new Error(
            "TOKEN_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes)"
        );
    }
    return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt a plaintext token string.
 * @returns Encrypted string in format `iv:authTag:ciphertext` (base64 parts)
 */
export function encryptToken(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    return [
        iv.toString("base64"),
        authTag.toString("base64"),
        encrypted,
    ].join(":");
}

/**
 * Decrypt an encrypted token string.
 * @returns Decrypted plaintext, or `null` if decryption fails
 */
export function decryptToken(encrypted: string): string | null {
    try {
        const key = getEncryptionKey();
        const [ivB64, authTagB64, ciphertext] = encrypted.split(":");

        if (!ivB64 || !authTagB64 || !ciphertext) {
            console.warn("[Encryption] Malformed encrypted token");
            return null;
        }

        const iv = Buffer.from(ivB64, "base64");
        const authTag = Buffer.from(authTagB64, "base64");

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, "base64", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (err) {
        console.warn(
            "[Encryption] Decryption failed — token may be corrupt or key changed:",
            (err as Error).message
        );
        return null;
    }
}

/**
 * Check whether a string looks like an encrypted token
 * (has the iv:authTag:ciphertext format).
 */
export function isEncryptedToken(value: string): boolean {
    const parts = value.split(":");
    return parts.length === 3 && parts.every((p) => p.length > 0);
}
