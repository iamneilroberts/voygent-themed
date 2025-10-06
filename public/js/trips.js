// Trip generation and display functions

import { getSelectedTheme } from './theme.js';
import { resetProgressSteps, addProgressLog } from './ui.js';

export let currentTripId = null;
export let selectedOptionKey = null;
export let selectedVariant = null;

export function resetPreviousResults() {
  // Clear trip state
  currentTripId = null;
  selectedOptionKey = null;
  selectedVariant = null;

  // Hide all result sections
  document.getElementById('researchSummary')?.classList.add('hidden');
  document.getElementById('optionsSection')?.classList.add('hidden');
  document.getElementById('variantsSection')?.classList.add('hidden');
  document.getElementById('itinerarySection')?.classList.add('hidden');
  document.getElementById('chatSection')?.classList.add('hidden');

  // Clear content
  document.getElementById('optionsGrid').innerHTML = '';
  document.getElementById('variantsContainer').innerHTML = '';
  const itineraryContent = document.getElementById('itineraryContent');
  if (itineraryContent) itineraryContent.innerHTML = '';
  document.getElementById('researchContent').innerHTML = '';
  document.getElementById('researchSources').innerHTML = '';

  // Reset progress UI
  resetProgressSteps();

  console.log('[RESET] Cleared all previous trip results');
}

// Expose to window for theme change callback and trip generation
window.resetPreviousResults = resetPreviousResults;
window.buildTextInput = buildTextInput;

export function buildTextInput() {
  const selectedTheme = getSelectedTheme();
  const quickSearchInput = document.getElementById('quickSearch')?.value.trim() || '';
  const surnames = document.getElementById('surnames').value.trim();
  const origins = document.getElementById('origins').value.trim();
  const adults = parseInt(document.getElementById('adults').value) || 2;
  const children = document.getElementById('children').value.trim();
  const duration = document.getElementById('duration').value.trim();
  const month = document.getElementById('month').value;
  const luxury = document.getElementById('luxury').value;
  const activity = document.getElementById('activity').value;
  const travelPace = document.getElementById('travel_pace').value;
  const airport = document.getElementById('airport').value.trim();
  const transportPref = document.getElementById('transport_pref').value;
  const hotelType = document.getElementById('hotel_type').value;
  const notes = document.getElementById('notes').value.trim();

  let text = '';

  // Start with quick search input if provided
  if (quickSearchInput) {
    text += `${quickSearchInput}\n\n`;
  }

  // Add theme-specific fields if surnames field is filled (it's reused for all themes)
  if (surnames) {
    text += `Family surnames: ${surnames}\n`;
  }
  if (origins) text += `Suspected origins: ${origins}\n`;

  // Party information
  text += `Party: ${adults} adult(s)`;
  if (children) text += `, children ages: ${children}`;
  text += `\n`;

  // Trip details
  if (duration) text += `Duration: ${duration} days\n`;
  if (month) text += `Target month: ${month}\n`;
  if (airport) text += `Departure airport: ${airport}\n`;
  text += `Transport preference: ${transportPref}\n`;
  text += `Travel pace: ${travelPace}\n`;
  text += `Hotel type: ${hotelType}\n`;
  text += `Luxury level: ${luxury}\n`;
  text += `Activity level: ${activity}\n`;
  if (notes) text += `\nAdditional notes:\n${notes}\n`;

  return text;
}

export function displayResearchSummary(researchSteps) {
  if (!researchSteps || researchSteps.length === 0) {
    console.log('[Research Display] No research steps to display');
    return;
  }

  const summaryDiv = document.getElementById('researchSummary');
  const contentDiv = document.getElementById('researchContent');
  const sourcesDiv = document.getElementById('researchSources');

  console.log('[Research Display] Processing research steps:', researchSteps);

  // Find different types of research steps
  const aiReasoning = researchSteps.find(step => step.step === 'ai_reasoning');
  const webSearch = researchSteps.find(step =>
    step.step === 'surname_research' ||
    step.step === 'filming_location_research' ||
    step.step === 'historical_research' ||
    step.step === 'culinary_research' ||
    step.step === 'adventure_research'
  );

  console.log('[Research Display] AI Reasoning:', aiReasoning ? 'Found' : 'Not found');
  console.log('[Research Display] Web Search:', webSearch ? 'Found' : 'Not found');

  // Display web search summary (available for all themes)
  if (webSearch && webSearch.summary) {
    let formattedHTML = `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #667eea; margin-bottom: 10px;">🔍 Research Summary</h3>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #667eea;">
          ${webSearch.summary.split('\n\n').map(para => `<p style="margin-bottom: 10px;">${para}</p>`).join('')}
        </div>
      </div>
    `;

    // Add AI reasoning if available (currently only for heritage)
    if (aiReasoning && aiReasoning.analysis) {
      const analysis = aiReasoning.analysis;
      const sections = analysis.split(/\d+\.\s+/).filter(s => s.trim());

      if (sections.length > 1) {
        formattedHTML += `
          <div style="margin-top: 20px;">
            <h3 style="color: #667eea; margin-bottom: 10px;">💡 AI Analysis</h3>
            ${sections.map((section, idx) => {
              if (idx === 0 && section.length < 100) {
                return `<p style="margin-bottom: 15px;"><strong>${section.trim()}</strong></p>`;
              }
              return `
                <div style="margin-bottom: 15px; padding-left: 20px; border-left: 3px solid #667eea;">
                  <strong style="color: #667eea;">${idx === 0 ? 'Key Finding' : `Point ${idx}`}:</strong>
                  <span style="margin-left: 10px;">${section.trim()}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        formattedHTML += `
          <div style="margin-top: 20px;">
            <h3 style="color: #667eea; margin-bottom: 10px;">💡 AI Analysis</h3>
            <p>${analysis}</p>
          </div>
        `;
      }
    }

    contentDiv.innerHTML = formattedHTML;

    // Add web search sources if available
    if (webSearch.sources && webSearch.sources.length > 0) {
      sourcesDiv.innerHTML = `
        <p style="margin-bottom: 10px; font-weight: 600;">Sources:</p>
        <ul style="list-style: none; padding: 0;">
          ${webSearch.sources.map(url => `
            <li style="margin: 8px 0;">
              <a href="${url}" target="_blank" style="color: #667eea; text-decoration: none; display: flex; align-items: center; gap: 8px;">
                🔗 ${new URL(url).hostname}
              </a>
            </li>
          `).join('')}
        </ul>
      `;
    } else {
      sourcesDiv.innerHTML = '';
    }

    contentDiv.innerHTML = formattedHTML;

    // Show the summary and scroll to it
    summaryDiv.classList.remove('hidden');
    addProgressLog('Research summary displayed', 'success');
    setTimeout(() => {
      summaryDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  } else {
    console.log('[Research Display] No summary content found');
  }
}

/**
 * Create a trip option card element
 * @param {Object} option - Single trip option from API
 * @param {Object} fullData - Complete trip response for context
 * @returns {HTMLElement} Card element
 */
function createTripOptionCard(option, fullData) {
  const card = document.createElement('div');
  card.className = 'trip-option-card';
  card.dataset.optionKey = option.key;

  // Extract cities from days array
  const cities = [...new Set(option.days.map(day => day.city))];
  const duration = option.days.length;

  // Format budget
  const budget = option.cost_estimate?.total_per_person || 0;
  const formattedBudget = budget > 0 ? `$${budget.toLocaleString()}` : 'Price TBD';

  card.innerHTML = `
    <div class="trip-option-header">
      <div class="trip-option-key">${option.key}</div>
      <h3 class="trip-option-title">${option.title}</h3>
    </div>
    <div class="trip-option-body">
      <div class="trip-option-duration">
        <span class="duration-badge">${duration} ${duration === 1 ? 'Day' : 'Days'}</span>
      </div>
      <div class="trip-option-cities">
        <strong>Cities:</strong> ${cities.slice(0, 3).join(', ')}${cities.length > 3 ? ` +${cities.length - 3} more` : ''}
      </div>
      <p class="trip-option-description">${option.whyOverall}</p>
      <div class="trip-option-budget">
        <strong>Est. Budget:</strong> ${formattedBudget} per person
      </div>
    </div>
    <div class="trip-option-footer">
      <button class="select-trip-btn" data-option-key="${option.key}">
        Select This Trip
      </button>
    </div>
  `;

  return card;
}

/**
 * Display trip options from /api/trips POST response
 * @param {Object} data - API response containing tripId, options, intake, etc.
 */
export function displayTripOptions(data) {
  console.log('[Trip Options] Displaying trip options:', data);

  // Validate input
  if (!data || !data.options || data.options.length === 0) {
    console.error('[Trip Options] No options to display');
    alert('No trip options were generated. Please try again.');
    return;
  }

  // Store trip ID globally for quote request
  currentTripId = data.tripId;
  window.currentTripId = data.tripId;

  const optionsSection = document.getElementById('optionsSection');
  const optionsGrid = document.getElementById('optionsGrid');

  if (!optionsSection || !optionsGrid) {
    console.error('[Trip Options] Required DOM elements not found');
    return;
  }

  // Clear previous options
  optionsGrid.innerHTML = '';

  // Render trip option cards
  data.options.forEach(option => {
    const card = createTripOptionCard(option, data);
    optionsGrid.appendChild(card);
  });

  // Attach selection handlers to all select buttons
  const selectButtons = optionsGrid.querySelectorAll('.select-trip-btn');
  selectButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const optionKey = e.target.dataset.optionKey;
      handleTripOptionSelection(optionKey, data);
    });
  });

  // Show the section
  optionsSection.classList.remove('hidden');
  addProgressLog(`Displaying ${data.options.length} trip options`, 'success');

  // Scroll to options
  setTimeout(() => {
    optionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 300);
}

/**
 * Handle selection of a trip option
 * @param {string} optionKey - The option key (A, B, C, or D)
 * @param {Object} fullData - Complete trip response
 */
function handleTripOptionSelection(optionKey, fullData) {
  console.log('[Trip Selection] Option selected:', optionKey);

  // Update state
  selectedOptionKey = optionKey;
  window.selectedOptionKey = optionKey;

  // Find the selected option
  const selectedOption = fullData.options.find(opt => opt.key === optionKey);
  if (!selectedOption) {
    console.error('[Trip Selection] Option not found:', optionKey);
    return;
  }

  // Update card visual states
  const allCards = document.querySelectorAll('.trip-option-card');
  allCards.forEach(card => {
    if (card.dataset.optionKey === optionKey) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  // Display itinerary for selected option
  displayItinerary(selectedOption, fullData);

  // Scroll to itinerary
  const itinerarySection = document.getElementById('itinerarySection');
  if (itinerarySection) {
    setTimeout(() => {
      itinerarySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }
}

/**
 * Display detailed itinerary for selected trip option
 * @param {Object} option - Selected trip option
 * @param {Object} fullData - Complete trip response for context
 */
function displayItinerary(option, fullData) {
  console.log('[Itinerary] Displaying itinerary for option:', option.key);

  const itinerarySection = document.getElementById('itinerarySection');
  const itineraryContent = document.getElementById('itineraryContent');

  if (!itinerarySection || !itineraryContent) {
    console.error('[Itinerary] Required DOM elements not found');
    return;
  }

  // Group days by city
  const citiesMap = new Map();
  option.days.forEach(day => {
    if (!citiesMap.has(day.city)) {
      citiesMap.set(day.city, []);
    }
    citiesMap.get(day.city).push(day);
  });

  // Build itinerary HTML
  let html = `
    <div class="itinerary-header">
      <h2>${option.title}</h2>
      <p class="itinerary-overview">${option.whyOverall}</p>
    </div>
  `;

  // Render each city section
  citiesMap.forEach((days, cityName) => {
    const nights = days.length;
    const countryCode = days[0].country || '';

    html += `
      <div class="city-section">
        <div class="city-header">
          <h3>${cityName}, ${countryCode}</h3>
          <span class="nights-badge">${nights} ${nights === 1 ? 'night' : 'nights'}</span>
        </div>
        <div class="city-days">
    `;

    // Render each day within this city
    days.forEach(day => {
      html += `
        <div class="day-card">
          <div class="day-number">Day ${day.d}</div>
          <div class="day-content">
            ${day.am ? `<div class="day-activity"><strong>Morning:</strong> ${day.am}</div>` : ''}
            ${day.pm ? `<div class="day-activity"><strong>Afternoon:</strong> ${day.pm}</div>` : ''}
            ${day.why ? `<div class="day-why">${day.why}</div>` : ''}
            ${day.rail ? `<div class="travel-info">🚆 Rail: ${day.rail}</div>` : ''}
            ${day.drive ? `<div class="travel-info">🚗 Drive: ${day.drive}</div>` : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  // Add cost breakdown section (T007)
  html += displayCostBreakdown(option);

  // Add quote button (T011)
  html += `
    <div class="itinerary-footer">
      <button id="requestQuoteBtn" class="request-quote-btn">
        Get a Free Quote for This Trip
      </button>
    </div>
  `;

  itineraryContent.innerHTML = html;

  // Attach quote button handler
  const quoteBtn = document.getElementById('requestQuoteBtn');
  if (quoteBtn) {
    quoteBtn.addEventListener('click', () => {
      handleQuoteRequest(fullData.tripId, option);
    });
  }

  // Show itinerary section
  itinerarySection.classList.remove('hidden');
  addProgressLog('Itinerary displayed', 'success');
}

/**
 * Generate cost breakdown HTML
 * @param {Object} option - Trip option with cost_estimate
 * @returns {string} HTML string for cost breakdown
 */
function displayCostBreakdown(option) {
  if (!option.cost_estimate) {
    return `
      <div class="cost-breakdown">
        <h3>Cost Estimate</h3>
        <p class="cost-disclaimer">Pricing details will be provided in your custom quote.</p>
      </div>
    `;
  }

  const cost = option.cost_estimate;
  const days = option.days.length;

  let html = `
    <div class="cost-breakdown">
      <h3>Estimated Costs</h3>
      <table class="cost-table">
  `;

  // Lodging
  if (cost.lodging_per_night && cost.lodging_per_night > 0) {
    const totalLodging = cost.lodging_per_night * days;
    html += `
      <tr>
        <td>Accommodations</td>
        <td class="cost-amount">$${totalLodging.toLocaleString()}</td>
        <td class="cost-notes">($${cost.lodging_per_night}/night × ${days} nights)</td>
      </tr>
    `;
  }

  // Transport
  if (cost.transport_total && cost.transport_total > 0) {
    html += `
      <tr>
        <td>Transportation</td>
        <td class="cost-amount">$${cost.transport_total.toLocaleString()}</td>
        <td class="cost-notes">(trains, car rental, local transport)</td>
      </tr>
    `;
  }

  // Activities
  if (cost.activities_per_day && cost.activities_per_day > 0) {
    const totalActivities = cost.activities_per_day * days;
    html += `
      <tr>
        <td>Activities & Admissions</td>
        <td class="cost-amount">$${totalActivities.toLocaleString()}</td>
        <td class="cost-notes">($${cost.activities_per_day}/day × ${days} days)</td>
      </tr>
    `;
  }

  // Meals
  if (cost.meals_per_day && cost.meals_per_day > 0) {
    const totalMeals = cost.meals_per_day * days;
    html += `
      <tr>
        <td>Meals</td>
        <td class="cost-amount">$${totalMeals.toLocaleString()}</td>
        <td class="cost-notes">($${cost.meals_per_day}/day × ${days} days)</td>
      </tr>
    `;
  }

  // Total
  if (cost.total_per_person && cost.total_per_person > 0) {
    html += `
      <tr class="cost-total">
        <td><strong>Total Per Person</strong></td>
        <td class="cost-amount"><strong>$${cost.total_per_person.toLocaleString()}</strong></td>
        <td class="cost-notes">(estimated)</td>
      </tr>
    `;
  }

  html += `
      </table>
  `;

  // Add breakdown notes if available
  if (cost.breakdown_notes) {
    html += `<p class="cost-notes-detail">${cost.breakdown_notes}</p>`;
  }

  // Add assumptions if available
  if (option.assumptions && option.assumptions.length > 0) {
    html += `
      <div class="cost-assumptions">
        <strong>Assumptions:</strong>
        <ul>
          ${option.assumptions.map(assumption => `<li>${assumption}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Disclaimer
  html += `
      <p class="cost-disclaimer">
        <em>These are estimates based on typical costs. Final pricing and availability will be confirmed in your custom quote from a travel professional.</em>
      </p>
    </div>
  `;

  return html;
}

/**
 * Handle quote request button click
 * @param {string} tripId - Trip ID
 * @param {Object} option - Selected trip option
 */
function handleQuoteRequest(tripId, option) {
  console.log('[Quote Request] Initiating quote request for trip:', tripId, 'option:', option.key);

  // Check if showTravelerIntake exists (from traveler-intake.js)
  if (typeof window.showTravelerIntake === 'function') {
    const budget = option.cost_estimate?.total_per_person || 0;
    window.showTravelerIntake(tripId, {
      selectedOption: option.key,
      estimatedBudget: budget,
      tripTitle: option.title
    });
  } else {
    console.error('[Quote Request] showTravelerIntake function not found');
    alert('Quote request system not available. Please contact support.');
  }
}

// Expose to window for main.js
window.displayTripOptions = displayTripOptions;
