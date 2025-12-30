/**
 * VoyGent V3 - API Client
 * Fetch wrapper for /api/* endpoints
 */

const API_BASE_URL = window.location.origin;

/**
 * API Client
 */
class APIClient {
  /**
   * Get featured templates
   */
  async getTemplates() {
    const response = await fetch(`${API_BASE_URL}/api/templates`);
    if (!response.ok) {
      throw new Error('Failed to fetch templates');
    }
    return await response.json();
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId) {
    const response = await fetch(`${API_BASE_URL}/api/templates/${templateId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch template');
    }
    return await response.json();
  }

  /**
   * Create new trip
   */
  async createTrip(templateId, initialMessage, preferences = null) {
    const response = await fetch(`${API_BASE_URL}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        initial_message: initialMessage,
        preferences,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create trip');
    }

    return await response.json();
  }

  /**
   * Get trip state
   */
  async getTrip(tripId) {
    const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch trip');
    }
    return await response.json();
  }

  /**
   * Send chat message
   */
  async sendChatMessage(tripId, message) {
    const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    return await response.json();
  }

  /**
   * Confirm destinations
   */
  async confirmDestinations(tripId, confirmedDestinations, preferences = null) {
    const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/confirm-destinations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        confirmed_destinations: confirmedDestinations,
        preferences,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to confirm destinations');
    }

    return await response.json();
  }

  /**
   * Select trip option
   */
  async selectTripOption(tripId, optionIndex) {
    const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ option_index: optionIndex }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to select trip option');
    }

    return await response.json();
  }

  /**
   * Generate daily itinerary for a trip option (on-demand)
   * @param {string} tripId - Trip ID
   * @param {number} optionIndex - Option index to generate itinerary for
   */
  async generateItinerary(tripId, optionIndex) {
    const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/itinerary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ option_index: optionIndex }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate itinerary');
    }

    return await response.json();
  }

  /**
   * Generate handoff document
   * @param {string} tripId - Trip ID
   * @param {Object} userContact - Contact info { name, email, phone }
   * @param {Array} travelers - Array of { name, age, type: 'adult'|'child'|'infant' }
   * @param {string} specialRequests - Special requests text
   */
  async generateHandoff(tripId, userContact = null, travelers = null, specialRequests = null) {
    const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/handoff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_contact: userContact,
        travelers: travelers,
        special_requests: specialRequests,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate handoff');
    }

    return await response.json();
  }

  /**
   * Download trip document as HTML
   * Opens in new tab or downloads based on browser behavior
   * @param {string} tripId - Trip ID
   */
  downloadDocument(tripId) {
    // Open in new tab - browser will download due to Content-Disposition header
    window.open(`${API_BASE_URL}/api/trips/${tripId}/document`, '_blank');
  }

  /**
   * Download agent handoff document as HTML
   * Includes full client intake info and all preferences
   * @param {string} tripId - Trip ID
   */
  downloadAgentDocument(tripId) {
    window.open(`${API_BASE_URL}/api/trips/${tripId}/agent-document`, '_blank');
  }
}

// Create singleton instance
const apiClient = new APIClient();

// Export for modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { apiClient, APIClient };
}
