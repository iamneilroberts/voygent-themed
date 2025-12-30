/**
 * VoyGent V3 - Chat Interface
 * Handles chat messages, destinations, and trip state
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
  initializePreferencesForm();
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

      // Send message to API
      const response = await apiClient.sendChatMessage(tripId, message);

      // Add assistant response to UI
      addMessageToChat('assistant', response.response);

      // Update trip state
      await loadTripState();
    } catch (error) {
      console.error('Failed to send message:', error);
      addMessageToChat('assistant', 'Sorry, I encountered an error. Please try again.');
    } finally {
      // Re-enable input
      chatInput.disabled = false;
      sendBtn.disabled = false;
      chatInput.focus();
    }
  });
}

/**
 * Initialize preferences form
 */
function initializePreferencesForm() {
  const preferencesForm = document.getElementById('preferencesForm');

  preferencesForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const preferences = {
      duration: document.getElementById('duration').value,
      departure_airport: document.getElementById('departure_airport').value,
      travelers_adults: parseInt(document.getElementById('travelers_adults').value),
      luxury_level: document.getElementById('luxury_level').value,
    };

    // TODO: Update preferences via API
    console.log('Preferences updated:', preferences);
    alert('Preferences updated! These will be used when building your trip.');
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

    // Get current preferences
    const preferences = {
      duration: document.getElementById('duration').value || undefined,
      departure_airport: document.getElementById('departure_airport').value || undefined,
      travelers_adults: parseInt(document.getElementById('travelers_adults').value) || 2,
      luxury_level: document.getElementById('luxury_level').value || 'Comfort',
    };

    try {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Confirming...';

      await apiClient.confirmDestinations(tripId, confirmedDestinations, preferences);

      // Reload trip state
      await loadTripState();

      addMessageToChat('assistant', 'Destinations confirmed! Building your trip options now...');
    } catch (error) {
      console.error('Failed to confirm destinations:', error);
      alert('Failed to confirm destinations. Please try again.');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm Destinations';
    }
  });
}

/**
 * Load trip state from API
 */
async function loadTripState() {
  try {
    const trip = await apiClient.getTrip(tripId);
    currentTrip = trip;

    // Update template name
    const template = await apiClient.getTemplate(trip.template_id);
    document.getElementById('templateName').textContent = template.name;

    // Update progress
    updateProgress(trip.progress_percent || 0, trip.progress_message || '');

    // Update destinations
    updateDestinations(trip.research_destinations, trip.destinations_confirmed);

    // Update chat history
    if (trip.status === 'awaiting_confirmation' && !trip.destinations_confirmed) {
      // Show research summary first
      if (trip.research_summary) {
        displayResearchSummary(trip.research_summary);
      }
      // Then show destinations
      updateChatWithDestinations(trip.research_destinations);
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
 * Update destinations panel
 */
function updateDestinations(destinations, confirmed) {
  const destinationsList = document.getElementById('destinationsList');
  const confirmBtn = document.getElementById('confirmBtn');

  if (!destinations || destinations.length === 0) {
    destinationsList.innerHTML = '<p class="empty-state">Researching destinations...</p>';
    confirmBtn.style.display = 'none';
    return;
  }

  destinationsList.innerHTML = '';

  destinations.forEach((dest) => {
    const item = document.createElement('div');
    item.className = 'destination-item';
    item.innerHTML = `
      <h4>${dest.name}</h4>
      <div class="context">${dest.geographic_context}</div>
      <div class="rationale">${dest.rationale}</div>
      <div class="days">~${dest.estimated_days} days</div>
    `;
    destinationsList.appendChild(item);
  });

  // Show/hide confirm button
  if (confirmed) {
    confirmBtn.style.display = 'none';
  } else {
    confirmBtn.style.display = 'block';
  }
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

  let content = '**What I Found:**\n\n';
  content += researchSummary.summary + '\n\n';

  // Show sources
  if (researchSummary.sources && researchSummary.sources.length > 0) {
    content += '**Sources consulted:**\n';
    researchSummary.sources.slice(0, 5).forEach((source) => {
      content += `- ${source.title}\n`;
    });
  }

  message.innerHTML = formatMessageContent(content);
  chatMessages.appendChild(message);

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

  let content = 'Based on your interests, I recommend these destinations:\n\n';
  destinations.forEach((dest, index) => {
    content += `${index + 1}. **${dest.name}** (${dest.geographic_context})\n`;
    content += `   ${dest.rationale}\n`;
    content += `   Estimated duration: ${dest.estimated_days} days\n\n`;
  });
  content += 'Would you like to proceed with these destinations, or would you like me to make any changes?';

  message.innerHTML = formatMessageContent(content);
  chatMessages.appendChild(message);

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
  // Basic formatting: **bold**, \n to <br>
  return content
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
