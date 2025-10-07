/**
 * JWT Utility Functions
 * Feature: 006-add-full-logging
 *
 * Provides JWT token generation and validation for admin authentication.
 */

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'super_admin' | 'agency_admin';
  agencyId: string | null;
  iat: number; // Issued at (Unix timestamp)
  exp: number; // Expires at (Unix timestamp)
}

export class JWTUtils {
  /**
   * Generate a JWT token
   */
  static async generateToken(
    payload: Omit<JWTPayload, 'iat' | 'exp'>,
    secret: string
  ): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JWTPayload = {
      ...payload,
      iat: now,
      exp: now + (7 * 24 * 60 * 60) // 7 days
    };

    const headerB64 = btoa(JSON.stringify(header));
    const payloadB64 = btoa(JSON.stringify(fullPayload));
    const signatureInput = `${headerB64}.${payloadB64}`;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signatureInput)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

    return `${signatureInput}.${signatureB64}`;
  }

  /**
   * Verify and decode a JWT token
   */
  static async verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
    try {
      const [headerB64, payloadB64, signatureB64] = token.split('.');

      if (!headerB64 || !payloadB64 || !signatureB64) {
        return null;
      }

      // Verify signature
      const signatureInput = `${headerB64}.${payloadB64}`;
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const expectedSignature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
      const valid = await crypto.subtle.verify(
        'HMAC',
        key,
        expectedSignature,
        new TextEncoder().encode(signatureInput)
      );

      if (!valid) return null;

      // Parse payload
      const payload: JWTPayload = JSON.parse(atob(payloadB64));

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) return null;

      return payload;
    } catch {
      return null;
    }
  }
}
