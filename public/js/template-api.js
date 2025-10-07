/**
 * Template API Module
 * Handles fetching and caching trip templates from the API
 */

let cachedTemplates = null;

/**
 * Fetch all active templates from the API
 * @returns {Promise<Array>} Array of template objects
 */
export async function fetchTemplates() {
  try {
    console.log('[Template API] Fetching templates from /api/templates');

    const response = await fetch('/api/templates');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const templates = data.templates || [];

    console.log(`[Template API] Fetched ${templates.length} templates`);

    // Validate templates
    const validTemplates = templates.filter(t => {
      if (!t.id || !t.name || !t.icon) {
        console.warn('[Template API] Invalid template:', t);
        return false;
      }
      return true;
    });

    // Cache the valid templates
    cachedTemplates = validTemplates;

    return validTemplates;
  } catch (error) {
    console.error('[Template API] Failed to fetch templates:', error);
    throw error;
  }
}

/**
 * Get cached templates (null if not yet fetched)
 * @returns {Array|null} Cached templates or null
 */
export function getCachedTemplates() {
  return cachedTemplates;
}

/**
 * Set cached templates (for testing/manual override)
 * @param {Array} templates - Array of template objects
 */
export function setCachedTemplates(templates) {
  cachedTemplates = templates;
}

/**
 * Clear cached templates (force refetch on next call)
 */
export function clearCache() {
  cachedTemplates = null;
}

/**
 * Get a single template by ID from cache
 * @param {string} templateId - Template ID
 * @returns {Object|null} Template object or null if not found
 */
export function getTemplateById(templateId) {
  if (!cachedTemplates) return null;
  return cachedTemplates.find(t => t.id === templateId) || null;
}

/**
 * Get featured/primary templates only
 * @returns {Array} Array of featured templates
 */
export function getFeaturedTemplates() {
  if (!cachedTemplates) return [];
  return cachedTemplates.filter(t => t.isFeatured === true);
}

/**
 * Get secondary (non-featured) templates
 * @returns {Array} Array of secondary templates
 */
export function getSecondaryTemplates() {
  if (!cachedTemplates) return [];
  return cachedTemplates.filter(t => !t.isFeatured);
}

/**
 * Get fallback templates (used when API fails)
 * @returns {Array} Array of default template objects
 */
export function getFallbackTemplates() {
  return [
    {
      id: 'heritage',
      name: 'Heritage & Ancestry',
      description: 'Explore your family roots and ancestral homelands',
      icon: '🌳',
      displayOrder: 1
    },
    {
      id: 'tvmovie',
      name: 'TV & Movie Locations',
      description: 'Visit filming locations from your favorite shows',
      icon: '🎬',
      displayOrder: 2
    },
    {
      id: 'historical',
      name: 'Historical Sites',
      description: 'Explore significant historical locations',
      icon: '⚔️',
      displayOrder: 3
    },
    {
      id: 'culinary',
      name: 'Culinary Experiences',
      description: 'Discover food and wine destinations',
      icon: '🍽️',
      displayOrder: 4
    },
    {
      id: 'adventure',
      name: 'Adventure & Outdoor',
      description: 'Explore nature and outdoor activities',
      icon: '🏔️',
      displayOrder: 5
    }
  ];
}
