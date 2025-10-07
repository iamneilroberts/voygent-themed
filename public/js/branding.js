/**
 * Branding Loader
 * Fetches and applies white-label branding configuration
 */

/**
 * Load branding configuration from API and apply to UI
 * @returns {Promise<Object>} Branding configuration
 */
export async function loadBranding() {
  try {
    const response = await fetch('/api/branding');
    const branding = await response.json();

    console.log('[Branding] Loaded branding:', branding);

    // Store agency_id for later use (quote submission)
    if (branding.agency_id) {
      localStorage.setItem('agency_id', branding.agency_id);
    } else {
      localStorage.removeItem('agency_id');
    }

    // Apply branding to UI
    applyBranding(branding);

    return branding;
  } catch (error) {
    console.error('[Branding] Failed to load branding:', error);

    // Use default branding on error
    const defaultBranding = {
      name: 'Voygent',
      logo_url: '/logo.png',
      primary_color: '#667eea',
      accent_color: '#764ba2',
      agency_id: null
    };

    applyBranding(defaultBranding);
    return defaultBranding;
  }
}

/**
 * Apply branding configuration to UI
 * @param {Object} branding - Branding configuration
 */
function applyBranding(branding) {
  // Update logo in header
  const logo = document.querySelector('header h1');
  if (logo) {
    if (branding.logo_url && branding.logo_url !== '/logo.png') {
      // Use custom logo image
      logo.innerHTML = `<img src="${branding.logo_url}" alt="${branding.name}" style="max-height: 40px; vertical-align: middle;" onerror="this.style.display='none'; this.parentElement.textContent='🌍 ${branding.name}';" />`;
    } else {
      // Use text logo
      logo.textContent = `🌍 ${branding.name}`;
    }
  }

  // Update CSS custom properties for colors
  document.documentElement.style.setProperty('--primary-color', branding.primary_color);
  document.documentElement.style.setProperty('--accent-color', branding.accent_color);

  // Update page title
  document.title = `${branding.name} - AI-Powered Travel Planning`;

  // Note: "Get a free quote" button text will be updated when button is created during trip display
  // This is handled in the trips.js module when showing trip results
}

/**
 * Get branding name for use in dynamic text
 * @returns {string} Agency name or 'Voygent'
 */
export function getBrandingName() {
  const agencyId = localStorage.getItem('agency_id');
  if (agencyId) {
    // Try to get name from page title
    const title = document.title.split(' - ')[0];
    return title || 'a travel professional';
  }
  return 'a travel professional';
}
