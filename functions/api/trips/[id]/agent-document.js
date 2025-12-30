/**
 * GET /api/trips/:id/agent-document
 * Generate downloadable HTML document for travel agent
 * Includes client intake info, preferences, and all trip details
 */
import { createDatabaseClient } from '../../../lib/db';
import { createLogger } from '../../../lib/logger';
import { createTripBuilderService } from '../../../services/trip-builder-service';
export async function onRequestGet(context) {
    const logger = createLogger();
    const db = createDatabaseClient(context.env);
    const tripId = context.params.id;
    try {
        logger.info(`Generating agent document for trip ${tripId}`);
        // Get trip
        const trip = await db.getTrip(tripId);
        if (!trip) {
            return new Response('Trip not found', { status: 404 });
        }
        // Get template
        const template = await db.getTemplate(trip.template_id);
        const templateName = template?.name || 'Travel Request';
        // Parse all trip data
        const chatHistory = trip.chat_history ? JSON.parse(trip.chat_history) : [];
        const preferences = trip.preferences_json ? JSON.parse(trip.preferences_json) : {};
        const userContact = trip.user_contact_json ? JSON.parse(trip.user_contact_json) : null;
        const destinations = trip.confirmed_destinations ? JSON.parse(trip.confirmed_destinations) : [];
        const researchSummary = trip.research_summary ? JSON.parse(trip.research_summary) : null;
        const researchDestinations = trip.research_destinations ? JSON.parse(trip.research_destinations) : [];
        // Get selected option if available
        let selectedOption = null;
        if (trip.options_json && trip.selected_option_index) {
            const options = JSON.parse(trip.options_json);
            selectedOption = options.find(o => o.option_index === trip.selected_option_index) || null;
            // Generate itinerary if not present
            if (selectedOption && (!selectedOption.daily_itinerary || selectedOption.daily_itinerary.length === 0)) {
                try {
                    const tripDays = parseInt(preferences.duration?.match(/\d+/)?.[0] || '7');
                    const tripBuilder = createTripBuilderService(context.env, db, logger);
                    selectedOption = await tripBuilder.generateDailyItinerary(tripId, selectedOption, destinations, tripDays);
                }
                catch (error) {
                    logger.warn(`Failed to generate itinerary: ${error}`);
                }
            }
        }
        // Get initial user message
        const initialMessage = chatHistory.find(m => m.role === 'user')?.content || 'No initial message';
        // Parse travelers from special_requests or user_contact (stored during handoff)
        let travelers = [];
        // Travelers are typically stored as part of the handoff request
        // We'll extract them from the chat or special requests if available
        // Generate HTML document
        const html = generateAgentDocument(tripId, templateName, template?.description || '', initialMessage, userContact, travelers, preferences, trip.special_requests || null, destinations, researchDestinations, researchSummary, selectedOption, trip.ai_cost_usd || 0, trip.api_cost_usd || 0, trip.created_at, trip.status);
        // Log telemetry
        await logger.logTelemetry(db, tripId, 'agent_document_generated', {
            details: {
                format: 'html',
                has_contact: Boolean(userContact),
                has_option: Boolean(selectedOption),
                status: trip.status,
            },
        });
        // Return as downloadable HTML
        const filename = `agent-${templateName.toLowerCase().replace(/\s+/g, '-')}-${tripId.slice(0, 8)}.html`;
        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
    catch (error) {
        logger.error(`Failed to generate agent document for trip ${tripId}: ${error}`);
        return new Response('Failed to generate document', { status: 500 });
    }
}
// CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
/**
 * Generate a comprehensive HTML document for travel agents
 */
function generateAgentDocument(tripId, templateName, templateDescription, initialMessage, userContact, travelers, preferences, specialRequests, destinations, researchDestinations, researchSummary, selectedOption, aiCost, apiCost, createdAt, status) {
    const createdDate = new Date(createdAt * 1000).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
    const currentDate = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Handoff - ${escapeHtml(templateName)} - ${tripId.slice(0, 8)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      color: #1f2937;
      background: #fff;
      padding: 30px;
      max-width: 1000px;
      margin: 0 auto;
    }

    @media print {
      body {
        padding: 15px;
        font-size: 10pt;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      padding: 25px;
      border-radius: 12px;
      margin-bottom: 25px;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
    }

    .header h1 {
      font-size: 1.6em;
      font-weight: 600;
      margin-bottom: 5px;
    }

    .header .trip-id {
      font-size: 0.85em;
      opacity: 0.9;
      font-family: monospace;
    }

    .header .status-badge {
      background: rgba(255,255,255,0.2);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 500;
    }

    .header .meta {
      font-size: 0.9em;
      opacity: 0.9;
    }

    /* Priority Alert Box */
    .priority-box {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 8px;
      padding: 15px 20px;
      margin-bottom: 25px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .priority-box .icon {
      font-size: 1.5em;
    }

    .priority-box .content {
      flex: 1;
    }

    .priority-box h3 {
      font-size: 1em;
      color: #92400e;
      margin-bottom: 3px;
    }

    .priority-box p {
      font-size: 0.9em;
      color: #78350f;
    }

    /* Section */
    section {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
    }

    section h2 {
      font-size: 1.1em;
      color: #1e40af;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #dbeafe;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .info-item {
      background: white;
      padding: 12px 15px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .info-item .label {
      font-size: 0.75em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .info-item .value {
      font-size: 1em;
      color: #111827;
      font-weight: 500;
    }

    .info-item .value a {
      color: #2563eb;
      text-decoration: none;
    }

    .info-item .value a:hover {
      text-decoration: underline;
    }

    /* Client Request Box */
    .request-box {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      margin-top: 15px;
    }

    .request-box .label {
      font-size: 0.75em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .request-box .content {
      font-size: 0.95em;
      color: #374151;
      font-style: italic;
      white-space: pre-wrap;
    }

    /* Destination Cards */
    .destination-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 12px;
    }

    .destination-card h4 {
      color: #1e40af;
      margin-bottom: 8px;
    }

    .destination-card .context {
      font-size: 0.85em;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .destination-card .rationale {
      font-size: 0.9em;
      color: #374151;
      margin-bottom: 8px;
    }

    .destination-card .sites {
      font-size: 0.85em;
      color: #059669;
    }

    /* Flight/Hotel/Tour Cards */
    .booking-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 12px;
    }

    .booking-card .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .booking-card .name {
      font-weight: 600;
      color: #111827;
    }

    .booking-card .price {
      font-weight: 600;
      color: #059669;
    }

    .booking-card .details {
      font-size: 0.9em;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .booking-card .url {
      font-size: 0.85em;
    }

    .booking-card .url a {
      color: #2563eb;
      word-break: break-all;
    }

    /* Day Itinerary */
    .day-block {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 15px;
      overflow: hidden;
    }

    .day-header {
      background: #1e40af;
      color: white;
      padding: 10px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .day-header .day-num {
      font-weight: 600;
    }

    .day-content {
      padding: 15px;
    }

    .activity-row {
      display: flex;
      gap: 15px;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }

    .activity-row:last-child {
      border-bottom: none;
    }

    .activity-time {
      font-weight: 600;
      color: #1e40af;
      min-width: 70px;
    }

    .activity-desc {
      flex: 1;
    }

    /* Cost Summary */
    .cost-table {
      width: 100%;
      border-collapse: collapse;
    }

    .cost-table th,
    .cost-table td {
      padding: 10px 15px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }

    .cost-table th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }

    .cost-table .total-row {
      background: #dbeafe;
      font-weight: 600;
    }

    .cost-table .total-row td {
      color: #1e40af;
    }

    /* Next Steps Checklist */
    .checklist {
      list-style: none;
    }

    .checklist li {
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .checklist li:last-child {
      border-bottom: none;
    }

    .checklist .checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid #9ca3af;
      border-radius: 4px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    /* Print Button */
    .print-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1e40af;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.95em;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .print-btn:hover {
      background: #1e3a8a;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 0.85em;
      border-top: 1px solid #e5e7eb;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print Document</button>

  <header class="header">
    <div class="header-top">
      <div>
        <h1>🧳 Agent Handoff Document</h1>
        <div class="trip-id">Trip ID: ${tripId}</div>
      </div>
      <div class="status-badge">${formatStatus(status)}</div>
    </div>
    <div class="meta">
      Trip Type: <strong>${escapeHtml(templateName)}</strong> •
      Created: ${createdDate} •
      Document Generated: ${currentDate}
    </div>
  </header>

  ${generatePriorityBox(status)}

  ${generateClientSection(userContact, travelers, specialRequests)}

  ${generateRequestSection(templateName, templateDescription, initialMessage, preferences)}

  ${generateDestinationsSection(destinations, researchDestinations, researchSummary)}

  ${selectedOption ? generateBookingsSection(selectedOption) : '<section><h2>📋 Trip Details</h2><p>No trip option selected yet.</p></section>'}

  ${selectedOption?.daily_itinerary ? generateItinerarySection(selectedOption.daily_itinerary) : ''}

  ${generateCostSection(selectedOption, aiCost, apiCost)}

  ${generateNextStepsSection(status)}

  <footer class="footer">
    <strong>VoyGent</strong> - AI-Powered Travel Planning<br>
    This document was auto-generated. Please verify all details before booking.
  </footer>
</body>
</html>`;
}
function generatePriorityBox(status) {
    if (status === 'handoff_sent') {
        return `
    <div class="priority-box">
      <div class="icon">⚡</div>
      <div class="content">
        <h3>New Booking Request - Action Required</h3>
        <p>Client has completed their trip selection and is awaiting agent contact within 24 hours.</p>
      </div>
    </div>`;
    }
    return '';
}
function generateClientSection(userContact, travelers, specialRequests) {
    if (!userContact) {
        return `
    <section>
      <h2>👤 Client Information</h2>
      <p style="color: #6b7280; font-style: italic;">Client contact information not provided yet.</p>
    </section>`;
    }
    const travelersHtml = travelers.length > 0 ? `
    <div class="info-item" style="grid-column: span 2;">
      <div class="label">Travelers</div>
      <div class="value">
        ${travelers.map(t => `${t.name}${t.age ? ` (Age ${t.age})` : ''} - ${t.type}`).join('<br>')}
      </div>
    </div>
  ` : '';
    return `
  <section>
    <h2>👤 Client Information</h2>
    <div class="info-grid">
      <div class="info-item">
        <div class="label">Name</div>
        <div class="value">${escapeHtml(userContact.name)}</div>
      </div>
      <div class="info-item">
        <div class="label">Email</div>
        <div class="value"><a href="mailto:${escapeHtml(userContact.email)}">${escapeHtml(userContact.email)}</a></div>
      </div>
      <div class="info-item">
        <div class="label">Phone</div>
        <div class="value">${userContact.phone ? `<a href="tel:${escapeHtml(userContact.phone)}">${escapeHtml(userContact.phone)}</a>` : 'Not provided'}</div>
      </div>
      ${travelersHtml}
    </div>
    ${specialRequests ? `
    <div class="request-box">
      <div class="label">Special Requests</div>
      <div class="content">${escapeHtml(specialRequests)}</div>
    </div>
    ` : ''}
  </section>`;
}
function generateRequestSection(templateName, templateDescription, initialMessage, preferences) {
    const prefItems = [];
    if (preferences.duration)
        prefItems.push({ label: 'Trip Duration', value: preferences.duration });
    if (preferences.departure_date)
        prefItems.push({ label: 'Departure Date', value: preferences.departure_date });
    if (preferences.departure_airport)
        prefItems.push({ label: 'Departure Airport', value: preferences.departure_airport });
    if (preferences.travelers_adults)
        prefItems.push({ label: 'Adults', value: String(preferences.travelers_adults) });
    if (preferences.travelers_children)
        prefItems.push({ label: 'Children', value: String(preferences.travelers_children) });
    if (preferences.luxury_level)
        prefItems.push({ label: 'Comfort Level', value: preferences.luxury_level });
    if (preferences.activity_level)
        prefItems.push({ label: 'Activity Level', value: preferences.activity_level });
    return `
  <section>
    <h2>📝 Trip Request Details</h2>
    <div class="info-grid">
      <div class="info-item" style="grid-column: span 2;">
        <div class="label">Trip Type</div>
        <div class="value">${escapeHtml(templateName)}</div>
      </div>
      ${prefItems.map(item => `
        <div class="info-item">
          <div class="label">${item.label}</div>
          <div class="value">${escapeHtml(item.value)}</div>
        </div>
      `).join('')}
    </div>
    <div class="request-box">
      <div class="label">Client's Initial Request</div>
      <div class="content">"${escapeHtml(initialMessage)}"</div>
    </div>
  </section>`;
}
function generateDestinationsSection(destinations, researchDestinations, researchSummary) {
    if (destinations.length === 0 && researchDestinations.length === 0) {
        return '';
    }
    const destinationCards = researchDestinations.map((dest, i) => `
    <div class="destination-card">
      <h4>${i + 1}. ${escapeHtml(dest.name)}</h4>
      <div class="context">${escapeHtml(dest.geographic_context || '')}</div>
      <div class="rationale">${escapeHtml(dest.rationale || '')}</div>
      ${dest.key_sites?.length ? `<div class="sites">📍 Key sites: ${dest.key_sites.map(escapeHtml).join(', ')}</div>` : ''}
    </div>
  `).join('');
    return `
  <section>
    <h2>🗺️ Confirmed Destinations</h2>
    <div class="info-item" style="margin-bottom: 15px;">
      <div class="label">Route</div>
      <div class="value" style="font-size: 1.1em;">${destinations.map(escapeHtml).join(' → ')}</div>
    </div>
    ${destinationCards}
    ${researchSummary?.summary ? `
    <div class="request-box">
      <div class="label">Research Summary</div>
      <div class="content" style="font-style: normal;">${escapeHtml(researchSummary.summary)}</div>
    </div>
    ` : ''}
  </section>`;
}
function generateBookingsSection(option) {
    const hotels = option.hotels || [];
    const tours = option.tours || [];
    const flights = option.flights;
    const flightsHtml = flights ? `
    <h3 style="margin: 20px 0 10px; color: #374151;">✈️ Flights</h3>
    <div class="booking-card">
      <div class="header-row">
        <div class="name">Outbound: ${escapeHtml(flights.outbound?.airline || 'TBD')}</div>
        <div class="price">$${flights.outbound?.cost_usd || 0}</div>
      </div>
      <div class="details">
        ${escapeHtml(flights.outbound?.route || '')}<br>
        ${formatDateTime(flights.outbound?.departure)} → ${formatDateTime(flights.outbound?.arrival)}
      </div>
    </div>
    <div class="booking-card">
      <div class="header-row">
        <div class="name">Return: ${escapeHtml(flights.return?.airline || 'TBD')}</div>
        <div class="price">$${flights.return?.cost_usd || 0}</div>
      </div>
      <div class="details">
        ${escapeHtml(flights.return?.route || '')}<br>
        ${formatDateTime(flights.return?.departure)} → ${formatDateTime(flights.return?.arrival)}
      </div>
    </div>
  ` : '';
    const hotelsHtml = hotels.length > 0 ? `
    <h3 style="margin: 20px 0 10px; color: #374151;">🏨 Hotels</h3>
    ${hotels.map(h => `
      <div class="booking-card">
        <div class="header-row">
          <div class="name">${escapeHtml(h.name)} ${'★'.repeat(h.rating || 0)}</div>
          <div class="price">$${(h.nights * h.cost_per_night_usd).toFixed(0)}</div>
        </div>
        <div class="details">
          ${escapeHtml(h.city)} • ${h.nights} nights • $${h.cost_per_night_usd}/night
        </div>
        ${h.info_url ? `<div class="url">🔗 <a href="${escapeHtml(h.info_url)}" target="_blank">${escapeHtml(h.info_url)}</a></div>` : '<div class="url" style="color: #dc2626;">⚠️ No booking URL available - manual search required</div>'}
      </div>
    `).join('')}
  ` : '';
    const toursHtml = tours.length > 0 ? `
    <h3 style="margin: 20px 0 10px; color: #374151;">🎯 Tours & Activities</h3>
    ${tours.map(t => `
      <div class="booking-card">
        <div class="header-row">
          <div class="name">${escapeHtml(t.name)}</div>
          <div class="price">$${t.cost_usd}</div>
        </div>
        <div class="details">
          ${escapeHtml(t.city)} • ${escapeHtml(t.duration)}
        </div>
        ${t.info_url ? `<div class="url">🔗 <a href="${escapeHtml(t.info_url)}" target="_blank">${escapeHtml(t.info_url)}</a></div>` : '<div class="url" style="color: #dc2626;">⚠️ No booking URL available - manual search required</div>'}
      </div>
    `).join('')}
  ` : '';
    return `
  <section>
    <h2>📋 Selected Trip Option (Option ${option.option_index})</h2>
    <div class="info-grid" style="margin-bottom: 20px;">
      <div class="info-item">
        <div class="label">Total Estimated Cost</div>
        <div class="value" style="font-size: 1.3em; color: #059669;">$${option.total_cost_usd.toFixed(0)}</div>
      </div>
      <div class="info-item">
        <div class="label">Highlights</div>
        <div class="value">${escapeHtml(option.itinerary_highlights || 'N/A')}</div>
      </div>
    </div>
    ${flightsHtml}
    ${hotelsHtml}
    ${toursHtml}
  </section>`;
}
function generateItinerarySection(dailyItinerary) {
    if (!dailyItinerary || dailyItinerary.length === 0)
        return '';
    const daysHtml = dailyItinerary.map(day => `
    <div class="day-block">
      <div class="day-header">
        <span class="day-num">Day ${day.day}</span>
        <span>${escapeHtml(day.location)}</span>
      </div>
      <div class="day-content">
        ${day.theme ? `<div style="font-style: italic; color: #6b7280; margin-bottom: 10px;">"${escapeHtml(day.theme)}"</div>` : ''}
        ${day.activities.map(a => `
          <div class="activity-row">
            <span class="activity-time">${escapeHtml(a.time)}</span>
            <span class="activity-desc">${escapeHtml(a.activity)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
    return `
  <section class="page-break">
    <h2>📅 Daily Itinerary</h2>
    ${daysHtml}
  </section>`;
}
function generateCostSection(option, aiCost, apiCost) {
    if (!option) {
        return `
    <section>
      <h2>💰 Cost Breakdown</h2>
      <p style="color: #6b7280;">Cost breakdown will be available once a trip option is selected.</p>
    </section>`;
    }
    const hotels = option.hotels || [];
    const tours = option.tours || [];
    const flightCost = (option.flights?.outbound?.cost_usd || 0) + (option.flights?.return?.cost_usd || 0);
    const hotelCost = hotels.reduce((sum, h) => sum + (h.nights * h.cost_per_night_usd), 0);
    const tourCost = tours.reduce((sum, t) => sum + t.cost_usd, 0);
    return `
  <section>
    <h2>💰 Cost Breakdown</h2>
    <table class="cost-table">
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Flights (roundtrip)</td>
          <td style="text-align: right;">$${flightCost.toFixed(0)}</td>
        </tr>
        <tr>
          <td>Accommodations (${hotels.length} hotels)</td>
          <td style="text-align: right;">$${hotelCost.toFixed(0)}</td>
        </tr>
        <tr>
          <td>Tours & Activities (${tours.length} items)</td>
          <td style="text-align: right;">$${tourCost.toFixed(0)}</td>
        </tr>
        <tr class="total-row">
          <td><strong>Total Estimated Cost</strong></td>
          <td style="text-align: right;"><strong>$${option.total_cost_usd.toFixed(0)}</strong></td>
        </tr>
      </tbody>
    </table>
    <p style="margin-top: 15px; font-size: 0.85em; color: #6b7280;">
      * Prices are estimates and may vary. Final pricing will be confirmed at time of booking.
    </p>
  </section>`;
}
function generateNextStepsSection(status) {
    return `
  <section>
    <h2>✅ Agent Checklist</h2>
    <ul class="checklist">
      <li>
        <div class="checkbox"></div>
        <span>Review client request and special requirements</span>
      </li>
      <li>
        <div class="checkbox"></div>
        <span>Verify flight availability and confirm pricing</span>
      </li>
      <li>
        <div class="checkbox"></div>
        <span>Check hotel availability and room types</span>
      </li>
      <li>
        <div class="checkbox"></div>
        <span>Confirm tour bookings and group sizes</span>
      </li>
      <li>
        <div class="checkbox"></div>
        <span>Prepare detailed proposal with final pricing</span>
      </li>
      <li>
        <div class="checkbox"></div>
        <span>Contact client within 24 hours</span>
      </li>
      <li>
        <div class="checkbox"></div>
        <span>Follow up on client questions and adjustments</span>
      </li>
      <li>
        <div class="checkbox"></div>
        <span>Process booking and send confirmation</span>
      </li>
    </ul>
  </section>`;
}
// Helper functions
function escapeHtml(str) {
    if (!str)
        return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function formatStatus(status) {
    const statusMap = {
        'researching': '🔍 Researching',
        'awaiting_confirmation': '⏳ Awaiting Confirmation',
        'building_trip': '🔧 Building Trip',
        'options_ready': '📋 Options Ready',
        'option_selected': '✓ Option Selected',
        'handoff_sent': '📨 Handoff Sent',
    };
    return statusMap[status] || status;
}
function formatDateTime(isoString) {
    if (!isoString)
        return 'TBD';
    try {
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    catch {
        return isoString;
    }
}
