/**
 * GET /api/trips/:id/document
 * Generate downloadable HTML travel document
 * Can be printed to PDF by the browser
 */

import { Env, createDatabaseClient, TripOption, DayItinerary } from '../../../lib/db';
import { createLogger } from '../../../lib/logger';
import { createTripBuilderService } from '../../../services/trip-builder-service';

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }): Promise<Response> {
  const logger = createLogger();
  const db = createDatabaseClient(context.env);
  const tripId = context.params.id;

  try {
    logger.info(`Generating HTML document for trip ${tripId}`);

    // Get trip
    const trip = await db.getTrip(tripId);
    if (!trip) {
      return new Response('Trip not found', { status: 404 });
    }

    // Verify trip has selected option
    if (!trip.selected_option_index || !trip.options_json) {
      return new Response('No trip option selected', { status: 400 });
    }

    // Get template
    const template = await db.getTemplate(trip.template_id);
    const templateName = template?.name || 'Travel Itinerary';

    // Parse trip data
    const options: TripOption[] = JSON.parse(trip.options_json);
    let selectedOption = options.find(opt => opt.option_index === trip.selected_option_index);
    const destinations: string[] = trip.confirmed_destinations
      ? JSON.parse(trip.confirmed_destinations)
      : [];
    const preferences = trip.preferences_json ? JSON.parse(trip.preferences_json) : {};

    if (!selectedOption) {
      return new Response('Selected option not found', { status: 400 });
    }

    // Generate daily itinerary on-demand if not present
    if (!selectedOption.daily_itinerary || selectedOption.daily_itinerary.length === 0) {
      try {
        const tripDays = parseInt(preferences.duration?.match(/\d+/)?.[0] || '7');
        const tripBuilder = createTripBuilderService(context.env, db, logger);
        selectedOption = await tripBuilder.generateDailyItinerary(
          tripId,
          selectedOption,
          destinations,
          tripDays
        );

        // Update the option in the database for caching
        const updatedOptions = options.map(o =>
          o.option_index === selectedOption!.option_index ? selectedOption! : o
        );
        await db.updateTripOptions(tripId, updatedOptions);
      } catch (error) {
        logger.warn(`Failed to generate daily itinerary: ${error}`);
      }
    }

    // Generate HTML document
    const html = generateTravelDocument(
      tripId,
      templateName,
      destinations,
      selectedOption,
      preferences
    );

    // Log telemetry
    await logger.logTelemetry(db, tripId, 'document_generated', {
      details: {
        format: 'html',
        destinations_count: destinations.length,
        has_itinerary: Boolean(selectedOption.daily_itinerary?.length),
      },
    });

    // Return as downloadable HTML
    const filename = `${templateName.toLowerCase().replace(/\s+/g, '-')}-${tripId.slice(0, 8)}.html`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    logger.error(`Failed to generate document for trip ${tripId}: ${error}`);
    return new Response('Failed to generate document', { status: 500 });
  }
}

// CORS preflight
export async function onRequestOptions(): Promise<Response> {
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
 * Generate a beautifully formatted HTML travel document
 */
function generateTravelDocument(
  tripId: string,
  tripType: string,
  destinations: string[],
  option: TripOption,
  preferences: any
): string {
  const hotels = option.hotels || [];
  const tours = option.tours || [];
  const dailyItinerary = option.daily_itinerary || [];
  const createdDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate trip dates from preferences or flights
  const tripDuration = preferences.duration || '7 days';
  const departureDate = option.flights?.outbound?.departure
    ? formatDateTime(option.flights.outbound.departure).date
    : 'TBD';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tripType} - ${destinations.join(' → ')}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }

    @media print {
      body {
        padding: 20px;
        font-size: 11pt;
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
      text-align: center;
      padding-bottom: 30px;
      border-bottom: 3px double #2c5aa0;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 2.2em;
      color: #2c5aa0;
      margin-bottom: 10px;
      font-weight: normal;
      letter-spacing: 1px;
    }

    .header .route {
      font-size: 1.4em;
      color: #666;
      margin-bottom: 15px;
    }

    .header .meta {
      font-size: 0.95em;
      color: #888;
    }

    /* Sections */
    section {
      margin-bottom: 35px;
    }

    h2 {
      font-size: 1.3em;
      color: #2c5aa0;
      border-bottom: 1px solid #ddd;
      padding-bottom: 8px;
      margin-bottom: 20px;
      font-weight: normal;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    h3 {
      font-size: 1.1em;
      color: #444;
      margin-bottom: 10px;
    }

    /* Summary Box */
    .summary-box {
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 25px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }

    .summary-item {
      text-align: center;
    }

    .summary-item .label {
      font-size: 0.85em;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .summary-item .value {
      font-size: 1.4em;
      color: #2c5aa0;
      font-weight: bold;
      margin-top: 5px;
    }

    /* Flight Cards */
    .flight-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
    }

    .flight-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .flight-type {
      background: #2c5aa0;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.85em;
      text-transform: uppercase;
    }

    .flight-airline {
      color: #666;
      font-style: italic;
    }

    .flight-route {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      margin: 20px 0;
    }

    .flight-city {
      text-align: center;
    }

    .flight-city .code {
      font-size: 1.8em;
      font-weight: bold;
      color: #2c5aa0;
    }

    .flight-city .time {
      font-size: 0.9em;
      color: #666;
    }

    .flight-arrow {
      color: #ccc;
      font-size: 1.5em;
    }

    /* Hotel & Tour Cards */
    .item-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .item-name {
      font-size: 1.1em;
      color: #333;
    }

    .item-location {
      color: #2c5aa0;
      font-size: 0.9em;
      margin-top: 3px;
    }

    .item-price {
      text-align: right;
    }

    .item-price .amount {
      font-size: 1.2em;
      font-weight: bold;
      color: #2c5aa0;
    }

    .item-price .detail {
      font-size: 0.8em;
      color: #888;
    }

    .item-details {
      display: flex;
      gap: 20px;
      color: #666;
      font-size: 0.9em;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #eee;
    }

    .stars {
      color: #f5a623;
    }

    /* Daily Itinerary */
    .day-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 20px;
      overflow: hidden;
    }

    .day-header {
      background: #2c5aa0;
      color: white;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .day-number {
      font-size: 1.1em;
      font-weight: bold;
    }

    .day-location {
      font-size: 0.9em;
      opacity: 0.9;
    }

    .day-content {
      padding: 20px;
    }

    .day-theme {
      font-style: italic;
      color: #666;
      margin-bottom: 15px;
    }

    .activity-list {
      list-style: none;
    }

    .activity-list li {
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      gap: 15px;
    }

    .activity-list li:last-child {
      border-bottom: none;
    }

    .activity-time {
      color: #2c5aa0;
      font-weight: bold;
      min-width: 70px;
    }

    .activity-desc {
      flex: 1;
    }

    /* Cost Summary */
    .cost-summary {
      background: #f8f9fa;
      border: 2px solid #2c5aa0;
      border-radius: 8px;
      padding: 25px;
    }

    .cost-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .cost-row:last-child {
      border-bottom: none;
      padding-top: 15px;
      margin-top: 10px;
      border-top: 2px solid #2c5aa0;
    }

    .cost-row.total .label,
    .cost-row.total .amount {
      font-size: 1.3em;
      font-weight: bold;
      color: #2c5aa0;
    }

    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #888;
      font-size: 0.9em;
    }

    .footer .logo {
      font-size: 1.2em;
      color: #2c5aa0;
      font-weight: bold;
      margin-bottom: 5px;
    }

    /* Print Button */
    .print-btn {
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: #2c5aa0;
      color: white;
      border: none;
      padding: 15px 25px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1em;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }

    .print-btn:hover {
      background: #1e4080;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>

  <header class="header">
    <h1>${escapeHtml(tripType)}</h1>
    <div class="route">${destinations.map(escapeHtml).join(' → ')}</div>
    <div class="meta">
      ${tripDuration} • Departure: ${departureDate} • Document generated ${createdDate}
    </div>
  </header>

  <section class="summary">
    <div class="summary-box">
      <div class="summary-item">
        <div class="label">Destinations</div>
        <div class="value">${destinations.length}</div>
      </div>
      <div class="summary-item">
        <div class="label">Duration</div>
        <div class="value">${tripDuration}</div>
      </div>
      <div class="summary-item">
        <div class="label">Total Cost</div>
        <div class="value">$${formatNumber(option.total_cost_usd)}</div>
      </div>
    </div>
  </section>

  ${generateFlightsSection(option)}

  ${generateHotelsSection(hotels)}

  ${generateToursSection(tours)}

  ${generateItinerarySection(dailyItinerary)}

  ${generateCostSummary(option, hotels, tours)}

  <footer class="footer">
    <div class="logo">VoyGent</div>
    <div>Trip ID: ${tripId}</div>
    <div>This document is for planning purposes. Prices and availability may vary.</div>
  </footer>
</body>
</html>`;
}

function generateFlightsSection(option: TripOption): string {
  if (!option.flights) return '';

  const outbound = option.flights.outbound;
  const returnFlight = option.flights.return;

  return `
  <section class="flights">
    <h2>✈️ Flights</h2>

    <div class="flight-card">
      <div class="flight-header">
        <span class="flight-type">Outbound</span>
        <span class="flight-airline">${escapeHtml(outbound.airline)}</span>
      </div>
      <div class="flight-route">
        <div class="flight-city">
          <div class="code">${escapeHtml(outbound.route.split(' → ')[0])}</div>
          <div class="time">${formatDateTime(outbound.departure).time}</div>
          <div class="time">${formatDateTime(outbound.departure).date}</div>
        </div>
        <div class="flight-arrow">→</div>
        <div class="flight-city">
          <div class="code">${escapeHtml(outbound.route.split(' → ')[1] || '')}</div>
          <div class="time">${formatDateTime(outbound.arrival).time}</div>
          <div class="time">${formatDateTime(outbound.arrival).date}</div>
        </div>
      </div>
    </div>

    <div class="flight-card">
      <div class="flight-header">
        <span class="flight-type">Return</span>
        <span class="flight-airline">${escapeHtml(returnFlight.airline)}</span>
      </div>
      <div class="flight-route">
        <div class="flight-city">
          <div class="code">${escapeHtml(returnFlight.route.split(' → ')[0])}</div>
          <div class="time">${formatDateTime(returnFlight.departure).time}</div>
          <div class="time">${formatDateTime(returnFlight.departure).date}</div>
        </div>
        <div class="flight-arrow">→</div>
        <div class="flight-city">
          <div class="code">${escapeHtml(returnFlight.route.split(' → ')[1] || '')}</div>
          <div class="time">${formatDateTime(returnFlight.arrival).time}</div>
          <div class="time">${formatDateTime(returnFlight.arrival).date}</div>
        </div>
      </div>
    </div>
  </section>`;
}

function generateHotelsSection(hotels: TripOption['hotels']): string {
  if (!hotels || hotels.length === 0) return '';

  const hotelCards = hotels.map(hotel => `
    <div class="item-card">
      <div class="item-header">
        <div>
          <div class="item-name">${escapeHtml(hotel.name)}</div>
          <div class="item-location">📍 ${escapeHtml(hotel.city)}</div>
        </div>
        <div class="item-price">
          <div class="amount">$${formatNumber(hotel.nights * hotel.cost_per_night_usd)}</div>
          <div class="detail">$${formatNumber(hotel.cost_per_night_usd)}/night</div>
        </div>
      </div>
      <div class="item-details">
        <span class="stars">${'★'.repeat(hotel.rating)}${'☆'.repeat(5 - hotel.rating)}</span>
        <span>${hotel.nights} night${hotel.nights > 1 ? 's' : ''}</span>
        ${hotel.info_url ? `<a href="${escapeHtml(hotel.info_url)}" target="_blank">View Details</a>` : ''}
      </div>
    </div>
  `).join('');

  return `
  <section class="hotels">
    <h2>🏨 Accommodations</h2>
    ${hotelCards}
  </section>`;
}

function generateToursSection(tours: TripOption['tours']): string {
  if (!tours || tours.length === 0) return '';

  const tourCards = tours.map(tour => `
    <div class="item-card">
      <div class="item-header">
        <div>
          <div class="item-name">${escapeHtml(tour.name)}</div>
          <div class="item-location">📍 ${escapeHtml(tour.city)}</div>
        </div>
        <div class="item-price">
          <div class="amount">$${formatNumber(tour.cost_usd)}</div>
          <div class="detail">per person</div>
        </div>
      </div>
      <div class="item-details">
        <span>⏱️ ${escapeHtml(tour.duration)}</span>
        ${tour.info_url ? `<a href="${escapeHtml(tour.info_url)}" target="_blank">View Details</a>` : ''}
      </div>
    </div>
  `).join('');

  return `
  <section class="tours">
    <h2>🎯 Tours & Activities</h2>
    ${tourCards}
  </section>`;
}

function generateItinerarySection(dailyItinerary: DayItinerary[]): string {
  if (!dailyItinerary || dailyItinerary.length === 0) return '';

  const dayCards = dailyItinerary.map(day => {
    const activities = day.activities.map(act => `
      <li>
        <span class="activity-time">${escapeHtml(act.time)}</span>
        <span class="activity-desc">${escapeHtml(act.activity)}</span>
      </li>
    `).join('');

    return `
    <div class="day-card">
      <div class="day-header">
        <span class="day-number">Day ${day.day}</span>
        <span class="day-location">📍 ${escapeHtml(day.location)}</span>
      </div>
      <div class="day-content">
        ${day.theme ? `<div class="day-theme">"${escapeHtml(day.theme)}"</div>` : ''}
        <ul class="activity-list">
          ${activities}
        </ul>
      </div>
    </div>
    `;
  }).join('');

  return `
  <section class="itinerary page-break">
    <h2>📅 Daily Itinerary</h2>
    ${dayCards}
  </section>`;
}

function generateCostSummary(option: TripOption, hotels: TripOption['hotels'], tours: TripOption['tours']): string {
  const flightCost = option.flights?.outbound?.cost_usd || 0;
  const hotelCost = (hotels || []).reduce((sum, h) => sum + (h.nights * h.cost_per_night_usd), 0);
  const tourCost = (tours || []).reduce((sum, t) => sum + t.cost_usd, 0);

  return `
  <section class="cost-breakdown">
    <h2>💰 Cost Summary</h2>
    <div class="cost-summary">
      <div class="cost-row">
        <span class="label">Flights (roundtrip)</span>
        <span class="amount">$${formatNumber(flightCost)}</span>
      </div>
      <div class="cost-row">
        <span class="label">Accommodations</span>
        <span class="amount">$${formatNumber(hotelCost)}</span>
      </div>
      <div class="cost-row">
        <span class="label">Tours & Activities</span>
        <span class="amount">$${formatNumber(tourCost)}</span>
      </div>
      <div class="cost-row total">
        <span class="label">Total Estimated Cost</span>
        <span class="amount">$${formatNumber(option.total_cost_usd)}</span>
      </div>
    </div>
  </section>`;
}

// Helper functions
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(num: number): string {
  if (!num) return '0';
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDateTime(isoString: string): { date: string; time: string } {
  if (!isoString) return { date: 'TBD', time: '' };
  try {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return { date: isoString, time: '' };
  }
}
