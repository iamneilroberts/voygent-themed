/**
 * VoyGent V3 - Chat Interface
 * Handles chat messages, telemetry, and trip state
 */

let tripId = null;
let currentTrip = null;
let pollInterval = null;
let itineraryCache = {}; // Cache for daily itineraries by option_index
let currentDetailOption = null; // Currently viewed option in detail modal

document.addEventListener('DOMContentLoaded', async () => {
  // Get trip ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  tripId = urlParams.get('trip_id');

  if (!tripId) {
    alert('No trip ID provided');
    window.location.href = '/';
    return;
  }

  // Initialize UI
  initializeChatForm();
  initializeConfirmButton();

  // Load initial trip state
  await loadTripState();

  // Start polling for updates (every 3 seconds)
  pollInterval = setInterval(async () => {
    await loadTripState();
  }, 3000);
});

/**
 * Initialize chat form
 */
function initializeChatForm() {
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = chatInput.value.trim();
    if (!message) return;

    // Disable input while sending
    chatInput.disabled = true;
    sendBtn.disabled = true;

    try {
      // Add user message to UI
      addMessageToChat('user', message);

      // Clear input
      chatInput.value = '';

      // Log to telemetry
      addTelemetryEntry('chat', 'Sending message...', { message: message.substring(0, 50) });

      // Send message to API
      const response = await apiClient.sendChatMessage(tripId, message);

      // Add assistant response to UI
      addMessageToChat('assistant', response.response);

      // Update trip state
      await loadTripState();
    } catch (error) {
      console.error('Failed to send message:', error);
      addMessageToChat('assistant', 'Sorry, I encountered an error. Please try again.');
      addTelemetryEntry('error', 'Chat failed', { error: error.message });
    } finally {
      // Re-enable input
      chatInput.disabled = false;
      sendBtn.disabled = false;
      chatInput.focus();
    }
  });
}

/**
 * Initialize confirm destinations button
 */
function initializeConfirmButton() {
  const confirmBtn = document.getElementById('confirmBtn');

  confirmBtn.addEventListener('click', async () => {
    if (!currentTrip || !currentTrip.research_destinations) {
      alert('No destinations to confirm');
      return;
    }

    const confirmedDestinations = currentTrip.research_destinations.map(d => d.name);

    try {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Building trip...';

      addTelemetryEntry('api', 'Confirming destinations', {
        destinations: confirmedDestinations
      });

      await apiClient.confirmDestinations(tripId, confirmedDestinations, null);

      // Hide confirm container
      document.getElementById('confirmContainer').style.display = 'none';

      // Reload trip state
      await loadTripState();

      addMessageToChat('assistant', 'Destinations confirmed! Now building your personalized trip options. This may take a few minutes...');
    } catch (error) {
      console.error('Failed to confirm destinations:', error);
      alert('Failed to confirm destinations. Please try again.');
      addTelemetryEntry('error', 'Confirm failed', { error: error.message });
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm & Build Trip';
    }
  });
}

/**
 * Load trip state from API
 */
async function loadTripState() {
  try {
    const trip = await apiClient.getTrip(tripId);

    // Check if state changed
    const stateChanged = !currentTrip || currentTrip.status !== trip.status;
    currentTrip = trip;

    // Update template name
    const template = await apiClient.getTemplate(trip.template_id);
    document.getElementById('templateName').textContent = template.name;

    // Update progress
    updateProgress(trip.progress_percent || 0, trip.progress_message || '');

    // Update telemetry panel
    updateTelemetryPanel(trip);

    // Handle different states
    if (trip.status === 'researching') {
      addTelemetryEntry('status', `Status: ${trip.status}`, {
        progress: trip.progress_percent
      });
    }

    if (trip.status === 'awaiting_confirmation' && !trip.destinations_confirmed) {
      // Show research summary first (if not already shown)
      if (trip.research_summary) {
        displayResearchSummary(trip.research_summary);
      }
      // Then show destinations
      updateChatWithDestinations(trip.research_destinations);
      // Show confirm button
      document.getElementById('confirmContainer').style.display = 'block';
    }

    // Update trip options
    if ((trip.status === 'options_ready' || trip.status === 'option_selected' || trip.status === 'handoff_sent') && trip.options) {
      updateTripOptions(trip.options, trip.selected_option_index);

      // Stop polling once options are ready - user will browse manually
      if (trip.status === 'options_ready' && pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }

      // If handoff was sent, show the final document
      if (trip.status === 'handoff_sent' && !document.querySelector('.handoff-document')) {
        // Stop polling
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }
    }
  } catch (error) {
    console.error('Failed to load trip state:', error);
  }
}

/**
 * Show handoff option after selection
 */
function showHandoffOption(trip) {
  // Remove existing handoff UI if present (for re-selection)
  const existing = document.getElementById('handoffContainer');
  if (existing) {
    existing.remove();
  }

  const selectedOption = trip.options.find(o => o.option_index === trip.selected_option_index);
  if (!selectedOption) return;

  const handoffContainer = document.createElement('div');
  handoffContainer.id = 'handoffContainer';
  handoffContainer.className = 'handoff-container';
  handoffContainer.innerHTML = `
    <div class="handoff-card">
      <h3>🎉 Option ${trip.selected_option_index} Selected!</h3>
      <p>Total: <strong>$${selectedOption.total_cost_usd.toFixed(0)}</strong></p>
      <p>Ready to book? Hand off to a travel agent to finalize your trip.</p>
      <button id="handoffBtn" class="btn btn-primary">Request Agent Handoff</button>
    </div>
  `;

  // Insert after trip options
  const tripOptionsContainer = document.getElementById('tripOptionsContainer');
  tripOptionsContainer.parentNode.insertBefore(handoffContainer, tripOptionsContainer.nextSibling);

  // Add handoff button handler - opens the intake form modal
  document.getElementById('handoffBtn').addEventListener('click', () => {
    openHandoffModal();
  });
}

/**
 * Open the handoff intake form modal
 */
function openHandoffModal() {
  const modal = document.getElementById('handoffModal');
  modal.style.display = 'flex';

  // Reset form
  document.getElementById('handoffForm').reset();

  // Reset travelers to just one row
  const container = document.getElementById('travelersContainer');
  container.innerHTML = `
    <div class="traveler-row" data-index="0">
      <input type="text" name="travelerName0" placeholder="Traveler name" required>
      <input type="number" name="travelerAge0" placeholder="Age" min="0" max="120" class="age-input">
      <select name="travelerType0">
        <option value="adult">Adult (18+)</option>
        <option value="child">Child (2-17)</option>
        <option value="infant">Infant (0-1)</option>
      </select>
      <button type="button" class="btn-remove-traveler" onclick="removeTraveler(0)" style="display: none;">&times;</button>
    </div>
  `;
  travelerCount = 1;

  // Initialize form handler if not already done
  initializeHandoffForm();
}

/**
 * Close the handoff intake form modal
 */
function closeHandoffModal() {
  document.getElementById('handoffModal').style.display = 'none';
}

let travelerCount = 1;
let handoffFormInitialized = false;

/**
 * Add another traveler row
 */
function addTraveler() {
  const container = document.getElementById('travelersContainer');
  const newIndex = travelerCount;

  const row = document.createElement('div');
  row.className = 'traveler-row';
  row.dataset.index = newIndex;
  row.innerHTML = `
    <input type="text" name="travelerName${newIndex}" placeholder="Traveler name" required>
    <input type="number" name="travelerAge${newIndex}" placeholder="Age" min="0" max="120" class="age-input">
    <select name="travelerType${newIndex}">
      <option value="adult">Adult (18+)</option>
      <option value="child">Child (2-17)</option>
      <option value="infant">Infant (0-1)</option>
    </select>
    <button type="button" class="btn-remove-traveler" onclick="removeTraveler(${newIndex})">&times;</button>
  `;

  container.appendChild(row);
  travelerCount++;

  // Show remove button on first traveler if we have more than one
  updateRemoveButtons();
}

/**
 * Remove a traveler row
 */
function removeTraveler(index) {
  const row = document.querySelector(`.traveler-row[data-index="${index}"]`);
  if (row) {
    row.remove();
    updateRemoveButtons();
  }
}

/**
 * Update remove button visibility
 */
function updateRemoveButtons() {
  const rows = document.querySelectorAll('.traveler-row');
  rows.forEach((row, i) => {
    const btn = row.querySelector('.btn-remove-traveler');
    if (btn) {
      btn.style.display = rows.length > 1 ? 'block' : 'none';
    }
  });
}

/**
 * Initialize handoff form submission
 */
function initializeHandoffForm() {
  if (handoffFormInitialized) return;
  handoffFormInitialized = true;

  const form = document.getElementById('handoffForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect contact info
    const userContact = {
      name: document.getElementById('contactName').value,
      email: document.getElementById('contactEmail').value,
      phone: document.getElementById('contactPhone').value || null,
    };

    // Collect travelers
    const travelers = [];
    document.querySelectorAll('.traveler-row').forEach(row => {
      const index = row.dataset.index;
      const name = row.querySelector(`[name="travelerName${index}"]`).value;
      const age = row.querySelector(`[name="travelerAge${index}"]`).value;
      const type = row.querySelector(`[name="travelerType${index}"]`).value;

      if (name) {
        travelers.push({
          name,
          age: age ? parseInt(age) : null,
          type,
        });
      }
    });

    // Collect special requests
    const specialRequests = document.getElementById('specialRequests').value || null;

    // Close modal and show loading
    closeHandoffModal();

    // Get button if it exists (may not exist in new detail modal flow)
    const btn = document.getElementById('handoffBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generating handoff...';
    }

    try {
      addTelemetryEntry('api', 'Requesting handoff', { travelers: travelers.length });

      const result = await apiClient.generateHandoff(tripId, userContact, travelers, specialRequests);

      // Display the handoff document
      displayHandoffDocument(result.handoff_document);

      // Update button if it exists
      if (btn) {
        btn.textContent = 'Handoff Complete ✓';
      }

      // Show success message
      addTelemetryEntry('success', 'Handoff complete', {
        handoff_id: result.handoff_id
      });
    } catch (error) {
      console.error('Handoff failed:', error);
      alert('Failed to generate handoff. Please try again.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Request Agent Handoff';
      }
    }
  });
}

/**
 * Display the handoff document in the UI
 */
function displayHandoffDocument(doc) {
  if (!doc) return;

  // Format customer info
  const customerInfoHtml = doc.user_contact && doc.user_contact.name !== 'Not provided' ? `
    <div class="customer-info-section">
      <h4>👤 Customer Information</h4>
      <div class="customer-details">
        <div class="customer-detail">
          <span class="label">Name</span>
          <span class="value">${doc.user_contact.name}</span>
        </div>
        <div class="customer-detail">
          <span class="label">Email</span>
          <span class="value">${doc.user_contact.email}</span>
        </div>
        ${doc.user_contact.phone ? `
          <div class="customer-detail">
            <span class="label">Phone</span>
            <span class="value">${doc.user_contact.phone}</span>
          </div>
        ` : ''}
      </div>
      ${doc.travelers && doc.travelers.length > 0 ? `
        <div class="travelers-list">
          <strong>Travelers (${doc.travelers.length}):</strong>
          ${doc.travelers.map(t => `
            <div class="traveler-item">
              <span>${t.name}</span>
              ${t.age ? `<span>Age ${t.age}</span>` : ''}
              <span class="traveler-type">${t.type}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  ` : '';

  // Format flights
  const flightsHtml = `
    <div class="handoff-section">
      <h4>✈️ Flights</h4>
      <div class="handoff-flight">
        <div class="flight-direction">Outbound</div>
        <div class="flight-details">
          <strong>${doc.flights.outbound.airline}</strong> ${doc.flights.outbound.route}
          <div class="flight-times">${formatDateTime(doc.flights.outbound.departure)} → ${formatDateTime(doc.flights.outbound.arrival)}</div>
        </div>
      </div>
      <div class="handoff-flight">
        <div class="flight-direction">Return</div>
        <div class="flight-details">
          <strong>${doc.flights.return.airline}</strong> ${doc.flights.return.route}
          <div class="flight-times">${formatDateTime(doc.flights.return.departure)} → ${formatDateTime(doc.flights.return.arrival)}</div>
        </div>
      </div>
    </div>
  `;

  // Format hotels with info links
  const hotelsHtml = `
    <div class="handoff-section">
      <h4>🏨 Hotels</h4>
      ${doc.hotels.map(h => `
        <div class="handoff-hotel">
          <div class="hotel-name">${h.name} ${'★'.repeat(h.rating || 0)}</div>
          <div class="hotel-details">${h.city} • ${h.nights} nights • $${h.cost_per_night_usd}/night</div>
          <div class="hotel-total">Subtotal: $${h.total_cost_usd || (h.nights * h.cost_per_night_usd)}</div>
          ${h.info_url ? `<a href="${h.info_url}" target="_blank" rel="noopener" class="info-link">🔗 View hotel info</a>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  // Format tours with info links
  const toursHtml = `
    <div class="handoff-section">
      <h4>🎯 Tours & Activities</h4>
      ${doc.tours.map(t => `
        <div class="handoff-tour">
          <div class="tour-name">${t.name}</div>
          <div class="tour-details">${t.city} • ${t.duration} • $${t.cost_usd}</div>
          ${t.info_url ? `<a href="${t.info_url}" target="_blank" rel="noopener" class="info-link">🔗 View tour info</a>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  // Format daily itinerary
  const dailyItineraryHtml = doc.daily_itinerary && doc.daily_itinerary.length > 0 ? `
    <div class="handoff-section daily-itinerary">
      <h4>📅 Day-by-Day Itinerary</h4>
      ${doc.daily_itinerary.map(day => `
        <div class="day-card">
          <div class="day-header">
            <span class="day-number">Day ${day.day_number}</span>
            ${day.theme ? `<span class="day-theme">${day.theme}</span>` : ''}
            <span class="day-city">${day.city}</span>
          </div>
          <div class="day-activities">
            ${day.activities.map(a => `
              <div class="activity-item">
                <div class="activity-time">${a.time}</div>
                <div class="activity-content">
                  <div class="activity-name">${a.activity}</div>
                  <div class="activity-meta">
                    <span class="activity-type ${a.type}">${formatActivityType(a.type)}</span>
                    ${a.location ? `📍 ${a.location}` : ''}
                    ${a.duration ? `⏱️ ${a.duration}` : ''}
                    ${a.cost_usd ? `<span class="activity-cost">$${a.cost_usd}</span>` : ''}
                  </div>
                  ${a.notes ? `<div class="activity-notes">💡 ${a.notes}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';

  // Format special requests
  const specialRequestsHtml = doc.special_requests && doc.special_requests !== 'None' ? `
    <div class="handoff-section">
      <h4>📝 Special Requests</h4>
      <p>${doc.special_requests}</p>
    </div>
  ` : '';

  // Format agent notes
  const agentNotesHtml = `
    <div class="handoff-section agent-notes">
      <h4>📋 Next Steps</h4>
      <ul>
        ${doc.agent_notes.next_steps.map(step => `<li>${step}</li>`).join('')}
      </ul>
    </div>
  `;

  // Create handoff document container
  const handoffDocHtml = `
    <div class="handoff-document">
      <div class="handoff-header">
        <h3>🎉 Trip Sent to Travel Agent!</h3>
        <p class="handoff-ref">Reference: ${doc.trip_id}</p>
      </div>

      ${customerInfoHtml}

      <div class="handoff-summary">
        <div class="summary-item">
          <span class="summary-label">Trip Type</span>
          <span class="summary-value">${doc.trip_type}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Destinations</span>
          <span class="summary-value">${doc.destinations.join(' → ')}</span>
        </div>
        <div class="summary-item total">
          <span class="summary-label">Total Cost</span>
          <span class="summary-value">$${doc.total_cost_usd.toFixed(2)}</span>
        </div>
      </div>

      ${flightsHtml}
      ${hotelsHtml}
      ${toursHtml}

      <div class="handoff-section highlights">
        <h4>✨ Itinerary Highlights</h4>
        <p>${doc.itinerary_highlights}</p>
      </div>

      ${dailyItineraryHtml}
      ${specialRequestsHtml}
      ${agentNotesHtml}

      <div class="handoff-footer">
        <p>A travel professional will contact you within <strong>24 hours</strong> to finalize your booking.</p>
        <div class="download-buttons">
          <button class="btn btn-outline download-btn" onclick="apiClient.downloadDocument('${doc.trip_id}')">
            📄 Download Trip Itinerary
          </button>
          <button class="btn btn-outline download-btn" onclick="apiClient.downloadAgentDocument('${doc.trip_id}')">
            🧳 Download Agent Document
          </button>
        </div>
      </div>
    </div>
  `;

  // Replace the handoff container content
  const handoffContainer = document.getElementById('handoffContainer');
  if (handoffContainer) {
    handoffContainer.innerHTML = handoffDocHtml;
  }
}

/**
 * Format activity type for display
 */
function formatActivityType(type) {
  const types = {
    'free': 'Free',
    'paid': 'Paid',
    'dining': 'Dining',
    'walking_tour': 'Walking Tour',
    'photo_op': 'Photo Op',
    'tour': 'Tour',
  };
  return types[type] || type;
}

/**
 * Format datetime string for display
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateStr;
  }
}

/**
 * Update progress bar and message
 */
function updateProgress(percent, message) {
  const progressFill = document.getElementById('progressFill');
  const progressMessage = document.getElementById('progressMessage');

  progressFill.style.width = `${percent}%`;
  progressMessage.textContent = message;
}

/**
 * Update telemetry panel with trip data
 */
function updateTelemetryPanel(trip) {
  // Update cost displays
  document.getElementById('aiCostDisplay').textContent =
    `$${(trip.ai_cost_usd || 0).toFixed(4)}`;
  document.getElementById('apiCostDisplay').textContent =
    `$${(trip.api_cost_usd || 0).toFixed(4)}`;

  // If there are telemetry logs, display them
  if (trip.telemetry_logs) {
    try {
      const logs = JSON.parse(trip.telemetry_logs);
      displayTelemetryLogs(logs);
    } catch (e) {
      // Logs might already be an object
      if (Array.isArray(trip.telemetry_logs)) {
        displayTelemetryLogs(trip.telemetry_logs);
      }
    }
  }
}

/**
 * Format telemetry details object for display
 */
function formatTelemetryDetails(details) {
  if (!details || typeof details !== 'object') return '';

  const parts = [];
  for (const [key, value] of Object.entries(details)) {
    if (value === null || value === undefined) continue;

    let displayValue;
    if (Array.isArray(value)) {
      // For arrays, show first few items
      if (value.length <= 3) {
        displayValue = value.join(', ');
      } else {
        displayValue = value.slice(0, 3).join(', ') + ` (+${value.length - 3} more)`;
      }
    } else if (typeof value === 'object') {
      // For nested objects, show compact JSON
      displayValue = JSON.stringify(value).substring(0, 100);
      if (JSON.stringify(value).length > 100) displayValue += '...';
    } else {
      displayValue = String(value);
    }

    parts.push(`<span class="detail-key">${key}:</span> ${displayValue}`);
  }

  return parts.join(' | ');
}

/**
 * Display telemetry logs
 */
function displayTelemetryLogs(logs) {
  const telemetryList = document.getElementById('telemetryList');

  if (!logs || logs.length === 0) {
    return;
  }

  // Clear placeholder
  if (telemetryList.querySelector('.empty-state')) {
    telemetryList.innerHTML = '';
  }

  // Check what's already displayed
  const existingCount = telemetryList.querySelectorAll('.telemetry-entry').length;

  // Add new entries
  logs.slice(existingCount).forEach((log) => {
    const entry = document.createElement('div');
    entry.className = `telemetry-entry telemetry-${log.event}`;

    const time = new Date(log.timestamp).toLocaleTimeString();
    const provider = log.provider || '';
    const model = log.model ? ` (${log.model})` : '';
    const tokens = log.tokens ? ` - ${log.tokens} tokens` : '';
    const cost = log.cost ? ` - $${log.cost.toFixed(4)}` : '';
    const duration = log.duration_ms ? ` - ${log.duration_ms}ms` : '';

    // Format details object if present
    let detailsStr = '';
    if (log.details) {
      detailsStr = formatTelemetryDetails(log.details);
    }

    entry.innerHTML = `
      <span class="time">${time}</span>
      <span class="event">${log.event}</span>
      <span class="details">${provider}${model}${tokens}${cost}${duration}</span>
      ${detailsStr ? `<div class="telemetry-details-expanded">${detailsStr}</div>` : ''}
    `;

    telemetryList.appendChild(entry);
  });

  // Scroll to bottom
  telemetryList.scrollTop = telemetryList.scrollHeight;
}

/**
 * Add manual telemetry entry (for client-side events)
 */
function addTelemetryEntry(type, event, details = {}) {
  const telemetryList = document.getElementById('telemetryList');

  // Clear placeholder if present
  if (telemetryList.querySelector('.empty-state')) {
    telemetryList.innerHTML = '';
  }

  const entry = document.createElement('div');
  entry.className = `telemetry-entry telemetry-${type}`;

  const time = new Date().toLocaleTimeString();
  const detailsStr = Object.entries(details)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(', ');

  entry.innerHTML = `
    <span class="time">${time}</span>
    <span class="event">${event}</span>
    <span class="details">${detailsStr}</span>
  `;

  telemetryList.appendChild(entry);
  telemetryList.scrollTop = telemetryList.scrollHeight;
}

/**
 * Display research summary in chat
 */
function displayResearchSummary(researchSummary) {
  const chatMessages = document.getElementById('chatMessages');

  // Check if we already added this message
  if (chatMessages.querySelector('.research-summary')) {
    return;
  }

  const message = document.createElement('div');
  message.className = 'message message-assistant research-summary';

  let content = '**What I Discovered:**\n\n';
  content += researchSummary.summary + '\n\n';

  // Show sources as clickable links
  if (researchSummary.sources && researchSummary.sources.length > 0) {
    content += '**Sources consulted:**\n';
    researchSummary.sources.slice(0, 5).forEach((source) => {
      content += `- [${source.title}](${source.url})\n`;
    });
  }

  message.innerHTML = formatMessageContent(content);
  chatMessages.appendChild(message);

  // Log to telemetry
  addTelemetryEntry('research', 'Research summary displayed', {
    queries: researchSummary.queries?.length || 0,
    sources: researchSummary.sources?.length || 0
  });

  scrollChatToBottom();
}

/**
 * Update chat with destinations
 * Supports both initial display and updates after refinement
 */
let lastDestinationsHash = null;

function updateChatWithDestinations(destinations, forceRefresh = false) {
  const chatMessages = document.getElementById('chatMessages');

  // Create a hash of current destinations to detect changes
  const currentHash = destinations.map(d => d.name).sort().join('|');

  // Check if destinations have changed
  const hasChanged = lastDestinationsHash !== null && lastDestinationsHash !== currentHash;

  // Check if we already added this message
  const existingMessage = chatMessages.querySelector('.destinations-intro');

  if (existingMessage && !hasChanged && !forceRefresh) {
    return; // No changes, skip update
  }

  // Update the hash
  lastDestinationsHash = currentHash;

  // Build content
  let content = '**Recommended Destinations:**\n\n';
  destinations.forEach((dest, index) => {
    content += `**${index + 1}. ${dest.name}** (${dest.geographic_context})\n`;
    content += `${dest.rationale}\n`;
    if (dest.key_sites && dest.key_sites.length > 0) {
      content += `Key sites: ${dest.key_sites.join(', ')}\n`;
    }
    content += `Estimated duration: ${dest.estimated_days} days\n\n`;
  });
  content += 'Would you like to proceed with these destinations, or would you like me to make any changes?\n\n';
  content += '_Tip: You can say "1&2" to select specific options, or "Ireland only" to filter by location._';

  if (existingMessage) {
    // Update existing message
    existingMessage.innerHTML = formatMessageContent(content);
    addTelemetryEntry('destinations', 'Destinations updated', {
      count: destinations.length,
      changed: hasChanged
    });
  } else {
    // Create new message
    const message = document.createElement('div');
    message.className = 'message message-assistant destinations-intro';
    message.innerHTML = formatMessageContent(content);
    chatMessages.appendChild(message);

    addTelemetryEntry('destinations', 'Destinations displayed', {
      count: destinations.length
    });
  }

  scrollChatToBottom();
}

/**
 * Add message to chat
 */
function addMessageToChat(role, content) {
  const chatMessages = document.getElementById('chatMessages');

  const message = document.createElement('div');
  message.className = `message message-${role}`;
  message.innerHTML = formatMessageContent(content);

  chatMessages.appendChild(message);

  scrollChatToBottom();
}

/**
 * Format message content (handle markdown-like formatting)
 */
function formatMessageContent(content) {
  // Convert markdown: links, bold, italics, then newlines
  return content
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

/**
 * Scroll chat to bottom
 */
function scrollChatToBottom() {
  const chatMessages = document.getElementById('chatMessages');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Update trip options display
 */
function updateTripOptions(options, selectedOptionIndex) {
  const tripOptionsContainer = document.getElementById('tripOptionsContainer');
  const tripOptionsGrid = document.getElementById('tripOptionsGrid');

  if (!options || options.length === 0) {
    tripOptionsContainer.style.display = 'none';
    return;
  }

  // Show options container
  tripOptionsContainer.style.display = 'block';

  // Clear existing options
  tripOptionsGrid.innerHTML = '';

  // Render each option
  options.forEach((option) => {
    const card = createTripOptionCard(option, selectedOptionIndex);
    tripOptionsGrid.appendChild(card);
  });

  addTelemetryEntry('options', 'Trip options displayed', {
    count: options.length
  });
}

/**
 * Create trip option card
 */
function createTripOptionCard(option, selectedOptionIndex) {
  const card = document.createElement('div');
  card.className = 'trip-option-card';
  if (option.option_index === selectedOptionIndex) {
    card.classList.add('selected');
  }

  const flightOutbound = option.flights?.outbound || {};
  const flightReturn = option.flights?.return || {};
  const hotels = option.hotels || [];
  const tours = option.tours || [];

  // Format flight as single line
  const flightLine = flightOutbound.route
    ? `${flightOutbound.route} round-trip`
    : 'Flights TBD';

  // Format hotels with names and ratings
  const hotelsHtml = hotels.length > 0
    ? hotels.map(h => {
        const stars = h.rating ? '★'.repeat(h.rating) : '';
        const nights = h.nights ? ` (${h.nights} nights)` : '';
        return `<div class="option-item">
          <span class="item-name">${h.name || 'Hotel'}</span>
          <span class="item-meta">${h.city}${nights} ${stars}</span>
        </div>`;
      }).join('')
    : '<div class="option-item-empty">Hotels TBD</div>';

  // Format tours with names
  const toursHtml = tours.length > 0
    ? tours.map(t => {
        const duration = t.duration || '';
        const cost = t.cost_usd ? `$${t.cost_usd}` : '';
        return `<div class="option-item">
          <span class="item-name">${t.name || 'Tour'}</span>
          <span class="item-meta">${t.city || ''} ${duration} ${cost}</span>
        </div>`;
      }).join('')
    : '<div class="option-item-empty">Tours TBD</div>';

  // Extract destinations from hotels
  const destinations = [...new Set(hotels.map(h => h.city).filter(Boolean))];
  const destinationsText = destinations.length > 0
    ? destinations.join(' → ')
    : 'Destinations TBD';

  card.innerHTML = `
    <div class="trip-option-header">
      <span class="trip-option-index">Option ${option.option_index}</span>
      <span class="trip-option-price">$${option.total_cost_usd.toFixed(0)}</span>
    </div>

    <div class="trip-option-route">${destinationsText}</div>

    <div class="trip-option-details">
      <div class="trip-option-section">
        <div class="trip-option-section-title">✈️ Flights</div>
        <div class="trip-option-section-content flight-summary">
          ${flightLine}
        </div>
      </div>

      <div class="trip-option-section">
        <div class="trip-option-section-title">🏨 Accommodation</div>
        <div class="trip-option-section-content hotels-list">
          ${hotelsHtml}
        </div>
      </div>

      <div class="trip-option-section">
        <div class="trip-option-section-title">🎯 Tours & Activities</div>
        <div class="trip-option-section-content tours-list">
          ${toursHtml}
        </div>
      </div>
    </div>

    <div class="trip-option-highlights">
      <strong>Highlights:</strong> ${option.itinerary_highlights || 'Explore historic sites, local culture, and scenic landscapes'}
    </div>

    <button class="btn btn-primary trip-option-view-btn" data-option-index="${option.option_index}">
      View Details
    </button>
  `;

  // Add click handler for view details button
  const viewBtn = card.querySelector('.trip-option-view-btn');
  viewBtn.addEventListener('click', async () => {
    await openOptionDetailModal(option);
  });

  return card;
}

/**
 * Open the option detail modal with daily itinerary
 */
async function openOptionDetailModal(option) {
  currentDetailOption = option;
  const modal = document.getElementById('optionDetailModal');
  const content = document.getElementById('optionDetailContent');

  // Show modal with loading state
  modal.style.display = 'flex';
  content.innerHTML = '<div class="loading-spinner">Loading itinerary...</div>';

  // Check cache first
  let itinerary = itineraryCache[option.option_index];

  if (!itinerary) {
    // Check if option already has daily_itinerary
    if (option.daily_itinerary && option.daily_itinerary.length > 0) {
      itinerary = option.daily_itinerary;
      itineraryCache[option.option_index] = itinerary;
    } else {
      // Fetch from API
      try {
        addTelemetryEntry('api', 'Fetching itinerary', { option: option.option_index });
        const result = await apiClient.generateItinerary(tripId, option.option_index);
        itinerary = result.daily_itinerary || [];
        itineraryCache[option.option_index] = itinerary;

        // Update option in currentTrip
        option.daily_itinerary = itinerary;

        addTelemetryEntry('api', 'Itinerary loaded', {
          option: option.option_index,
          days: itinerary.length,
          cached: result.cached
        });
      } catch (error) {
        console.error('Failed to load itinerary:', error);
        content.innerHTML = `
          <div class="error-message">
            <p>Failed to load itinerary. Please try again.</p>
            <button class="btn btn-secondary" onclick="closeOptionDetailModal()">Close</button>
          </div>
        `;
        return;
      }
    }
  }

  // Render the detail view
  renderOptionDetailContent(option, itinerary);
}

/**
 * Render the option detail content
 */
function renderOptionDetailContent(option, itinerary) {
  const content = document.getElementById('optionDetailContent');
  const hotels = option.hotels || [];
  const tours = option.tours || [];
  const flights = option.flights || {};

  // Extract destinations from hotels
  const destinations = [...new Set(hotels.map(h => h.city).filter(Boolean))];
  const destinationsText = destinations.length > 0 ? destinations.join(' → ') : 'Destinations TBD';

  // Format flights
  const flightsHtml = flights.outbound ? `
    <div class="detail-section">
      <h4>✈️ Flights</h4>
      <div class="detail-flight">
        <div class="flight-direction">Outbound</div>
        <div class="flight-details">
          <strong>${flights.outbound.airline || 'TBD'}</strong> ${flights.outbound.route || ''}
          <div class="flight-times">${formatDateTime(flights.outbound.departure)} → ${formatDateTime(flights.outbound.arrival)}</div>
        </div>
      </div>
      <div class="detail-flight">
        <div class="flight-direction">Return</div>
        <div class="flight-details">
          <strong>${flights.return?.airline || 'TBD'}</strong> ${flights.return?.route || ''}
          <div class="flight-times">${formatDateTime(flights.return?.departure)} → ${formatDateTime(flights.return?.arrival)}</div>
        </div>
      </div>
    </div>
  ` : '';

  // Format hotels with info links
  const hotelsHtml = hotels.length > 0 ? `
    <div class="detail-section">
      <h4>🏨 Hotels</h4>
      ${hotels.map(h => `
        <div class="detail-hotel">
          <div class="hotel-name">${h.name} ${'★'.repeat(h.rating || 0)}</div>
          <div class="hotel-details">${h.city} • ${h.nights} nights • $${h.cost_per_night_usd}/night</div>
          ${h.info_url ? `<a href="${h.info_url}" target="_blank" rel="noopener" class="info-link">🔗 View hotel info</a>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  // Format tours with info links
  const toursHtml = tours.length > 0 ? `
    <div class="detail-section">
      <h4>🎯 Tours & Activities</h4>
      ${tours.map(t => `
        <div class="detail-tour">
          <div class="tour-name">${t.name}</div>
          <div class="tour-details">${t.city} • ${t.duration} • $${t.cost_usd}</div>
          ${t.info_url ? `<a href="${t.info_url}" target="_blank" rel="noopener" class="info-link">🔗 View tour info</a>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  // Format daily itinerary
  const dailyItineraryHtml = itinerary && itinerary.length > 0 ? `
    <div class="detail-section daily-itinerary">
      <h4>📅 Day-by-Day Itinerary</h4>
      ${itinerary.map(day => `
        <div class="day-card">
          <div class="day-header">
            <span class="day-number">Day ${day.day_number}</span>
            ${day.theme ? `<span class="day-theme">${day.theme}</span>` : ''}
            <span class="day-city">${day.city}</span>
          </div>
          <div class="day-activities">
            ${day.activities.map(a => `
              <div class="activity-item">
                <div class="activity-time">${a.time}</div>
                <div class="activity-content">
                  <div class="activity-name">${a.activity}</div>
                  <div class="activity-meta">
                    <span class="activity-type ${a.type}">${formatActivityType(a.type)}</span>
                    ${a.location ? `📍 ${a.location}` : ''}
                    ${a.duration ? `⏱️ ${a.duration}` : ''}
                    ${a.cost_usd ? `<span class="activity-cost">$${a.cost_usd}</span>` : ''}
                  </div>
                  ${a.notes ? `<div class="activity-notes">💡 ${a.notes}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  ` : '<div class="detail-section"><p>Daily itinerary not available.</p></div>';

  content.innerHTML = `
    <div class="option-detail-header">
      <div class="option-detail-title">
        <h3>Option ${option.option_index}</h3>
        <span class="option-detail-price">$${option.total_cost_usd.toFixed(0)}</span>
      </div>
      <div class="option-detail-route">${destinationsText}</div>
    </div>

    <div class="option-detail-highlights">
      <strong>✨ Highlights:</strong> ${option.itinerary_highlights || 'Explore historic sites, local culture, and scenic landscapes'}
    </div>

    ${flightsHtml}
    ${hotelsHtml}
    ${toursHtml}
    ${dailyItineraryHtml}

    <div class="option-detail-actions">
      <button class="btn btn-secondary" onclick="closeOptionDetailModal()">← Compare Other Options</button>
      <button class="btn btn-outline" onclick="downloadTripDocument()">📄 Download Itinerary</button>
      <button class="btn btn-primary btn-quote" onclick="requestQuoteForOption(${option.option_index})">
        Get a Free Quote from a Travel Agent
      </button>
    </div>
  `;
}

/**
 * Close the option detail modal
 */
function closeOptionDetailModal() {
  const modal = document.getElementById('optionDetailModal');
  modal.style.display = 'none';
  currentDetailOption = null;
}

/**
 * Request a quote for the selected option
 */
async function requestQuoteForOption(optionIndex) {
  // First, select the option via API
  try {
    addTelemetryEntry('api', 'Selecting option for quote', { option: optionIndex });
    await apiClient.selectTripOption(tripId, optionIndex);

    // Close detail modal and open handoff modal
    closeOptionDetailModal();
    openHandoffModal();
  } catch (error) {
    console.error('Failed to select option:', error);
    alert('Failed to process your request. Please try again.');
  }
}

/**
 * Download trip document as HTML
 * Must have an option selected first
 */
async function downloadTripDocument() {
  try {
    // First ensure an option is selected
    if (currentDetailOption && currentTrip?.selected_option_index !== currentDetailOption.option_index) {
      addTelemetryEntry('api', 'Selecting option for download', { option: currentDetailOption.option_index });
      await apiClient.selectTripOption(tripId, currentDetailOption.option_index);
    }

    addTelemetryEntry('download', 'Downloading document', { trip_id: tripId });
    apiClient.downloadDocument(tripId);
  } catch (error) {
    console.error('Failed to download document:', error);
    alert('Failed to download document. Please select an option first.');
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});
