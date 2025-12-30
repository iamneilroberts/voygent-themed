/**
 * VoyGent V3 - Chat Interface
 * Handles chat messages, telemetry, and trip state
 */

let tripId = null;
let currentTrip = null;
let pollInterval = null;

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
    if (trip.status === 'options_ready' && trip.options) {
      updateTripOptions(trip.options, trip.selected_option_index);
    }
  } catch (error) {
    console.error('Failed to load trip state:', error);
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
 * Update chat with destinations (one-time message)
 */
function updateChatWithDestinations(destinations) {
  const chatMessages = document.getElementById('chatMessages');

  // Check if we already added this message
  if (chatMessages.querySelector('.destinations-intro')) {
    return;
  }

  const message = document.createElement('div');
  message.className = 'message message-assistant destinations-intro';

  let content = '**Recommended Destinations:**\n\n';
  destinations.forEach((dest, index) => {
    content += `**${index + 1}. ${dest.name}** (${dest.geographic_context})\n`;
    content += `${dest.rationale}\n`;
    if (dest.key_sites && dest.key_sites.length > 0) {
      content += `Key sites: ${dest.key_sites.join(', ')}\n`;
    }
    content += `Estimated duration: ${dest.estimated_days} days\n\n`;
  });
  content += 'Would you like to proceed with these destinations, or would you like me to make any changes?';

  message.innerHTML = formatMessageContent(content);
  chatMessages.appendChild(message);

  addTelemetryEntry('destinations', 'Destinations displayed', {
    count: destinations.length
  });

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
  // Convert markdown links [text](url) to HTML links
  // Then **bold**, then \n to <br>
  return content
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
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
  const hotelCount = option.hotels?.length || 0;
  const tourCount = option.tours?.length || 0;

  card.innerHTML = `
    <div class="trip-option-header">
      <span class="trip-option-index">Option ${option.option_index}</span>
      <span class="trip-option-price">$${option.total_cost_usd.toFixed(0)}</span>
    </div>

    <div class="trip-option-details">
      <div class="trip-option-section">
        <div class="trip-option-section-title">Flights</div>
        <div class="trip-option-section-content">
          ${flightOutbound.airline || 'TBD'}: ${flightOutbound.route || 'TBD'}<br>
          ${flightReturn.airline || 'TBD'}: ${flightReturn.route || 'TBD'}
        </div>
      </div>

      <div class="trip-option-section">
        <div class="trip-option-section-title">Accommodation</div>
        <div class="trip-option-section-content">
          ${hotelCount} hotel${hotelCount !== 1 ? 's' : ''} selected
        </div>
      </div>

      <div class="trip-option-section">
        <div class="trip-option-section-title">Tours & Activities</div>
        <div class="trip-option-section-content">
          ${tourCount} experience${tourCount !== 1 ? 's' : ''} included
        </div>
      </div>
    </div>

    <div class="trip-option-highlights">
      ${option.itinerary_highlights || 'Detailed itinerary available after selection'}
    </div>

    <button class="btn btn-primary trip-option-select-btn" data-option-index="${option.option_index}">
      ${option.option_index === selectedOptionIndex ? 'Selected ✓' : 'Select This Option'}
    </button>
  `;

  // Add click handler for select button
  const selectBtn = card.querySelector('.trip-option-select-btn');
  selectBtn.addEventListener('click', async () => {
    if (option.option_index === selectedOptionIndex) {
      return; // Already selected
    }

    try {
      selectBtn.disabled = true;
      selectBtn.textContent = 'Selecting...';

      addTelemetryEntry('api', 'Selecting option', {
        option: option.option_index
      });

      await apiClient.selectTripOption(tripId, option.option_index);

      // Reload trip state
      await loadTripState();

      addMessageToChat('assistant', `Great choice! Option ${option.option_index} has been selected. You can now request a handoff to a travel agent for booking.`);
    } catch (error) {
      console.error('Failed to select option:', error);
      alert('Failed to select option. Please try again.');
      selectBtn.disabled = false;
      selectBtn.textContent = 'Select This Option';
    }
  });

  return card;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});
