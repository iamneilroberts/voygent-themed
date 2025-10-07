/**
 * Branding API Endpoint
 * GET /api/branding
 *
 * Returns branding configuration based on the request domain.
 * - If custom domain matches agency record: returns agency branding
 * - Otherwise: returns default Voygent branding
 */

interface Env {
  DB: D1Database;
}

interface Agency {
  id: string;
  name: string;
  custom_domain: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  contact_email: string | null;
  contact_phone: string | null;
}

interface BrandingResponse {
  name: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  agency_id: string | null;
}

const DEFAULT_BRANDING: BrandingResponse = {
  name: 'Voygent',
  logo_url: '/logo.png',
  primary_color: '#667eea',
  accent_color: '#764ba2',
  agency_id: null
};

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  try {
    // Extract domain from request
    const url = new URL(request.url);
    const hostname = url.hostname;

    console.log('[Branding] Checking branding for hostname:', hostname);

    // Check if custom domain exists in agencies table
    const agency = await env.DB
      .prepare('SELECT * FROM agencies WHERE custom_domain = ?')
      .bind(hostname)
      .first<Agency>();

    if (!agency) {
      console.log('[Branding] No custom domain match, returning default branding');
      return new Response(JSON.stringify(DEFAULT_BRANDING), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        }
      });
    }

    console.log('[Branding] Found agency:', agency.name);

    // Return agency branding
    const branding: BrandingResponse = {
      name: agency.name,
      logo_url: agency.logo_url || DEFAULT_BRANDING.logo_url,
      primary_color: agency.primary_color || DEFAULT_BRANDING.primary_color,
      accent_color: agency.accent_color || DEFAULT_BRANDING.accent_color,
      agency_id: agency.id
    };

    return new Response(JSON.stringify(branding), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });

  } catch (error: any) {
    console.error('[Branding] Error loading branding:', error);

    // Fail gracefully with default branding
    return new Response(JSON.stringify(DEFAULT_BRANDING), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60' // Shorter cache on error
      }
    });
  }
}
