/**
 * Admin Authentication Endpoint
 * Feature: 006-add-full-logging
 * POST /api/admin/auth/login
 *
 * Authenticates admin users and returns JWT token.
 */

import { JWTUtils } from '../../lib/jwt-utils';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    agency_id: string | null;
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: LoginRequest = await request.json();

    // Validate input
    if (!body.email || !body.password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Query admin user
    const result = await env.DB.prepare(
      'SELECT * FROM admin_users WHERE email = ?'
    ).bind(body.email).first();

    if (!result) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify password
    // NOTE: For development, we're using a simple prefix check
    // In production, this should use bcrypt.compare()
    const passwordHash = result.password_hash as string;
    const valid = passwordHash.startsWith('INSECURE_PLAINTEXT_') &&
                  passwordHash.substring(19) === body.password;

    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate JWT
    const token = await JWTUtils.generateToken({
      userId: result.id as string,
      email: result.email as string,
      role: result.role as any,
      agencyId: result.agency_id as string | null
    }, env.JWT_SECRET || 'dev-secret-key');

    // Update last login
    await env.DB.prepare(
      'UPDATE admin_users SET last_login = ? WHERE id = ?'
    ).bind(Date.now(), result.id).run();

    const response: LoginResponse = {
      token,
      user: {
        id: result.id as string,
        email: result.email as string,
        role: result.role as string,
        agency_id: result.agency_id as string | null
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `admin_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`
      }
    });
  } catch (error: any) {
    console.error('[Admin Auth] Login error:', error);
    return new Response(JSON.stringify({ error: 'Login failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
