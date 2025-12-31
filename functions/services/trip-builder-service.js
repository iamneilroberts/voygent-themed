/**
 * Trip Builder Service
 * VoyGent V3 - Phase 2 Trip Building
 *
 * Orchestrates Phase 2 workflow:
 * 1. Search flights (Amadeus)
 * 2. Search hotels (Amadeus)
 * 3. Search tours (Viator)
 * 4. Use AI to generate 2-4 trip options with pricing
 * 5. Store options in database
 */
import { createCostTracker } from '../lib/cost-tracker';
import { createTemplateEngine } from '../lib/template-engine';
import { createAIProviderManager } from '../lib/ai-providers';
import { createAmadeusClient } from './amadeus-client';
import { createViatorClient } from './viator-client';
import { createFirecrawlClient } from './firecrawl-client';
import { jsonrepair } from 'jsonrepair';
/**
 * Extract and repair JSON from AI response
 */
function extractAndRepairJSON(text) {
    // Remove markdown code block markers
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    // Extract just the JSON array portion
    const arrayStart = cleaned.indexOf('[');
    const arrayEnd = cleaned.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
        cleaned = cleaned.slice(arrayStart, arrayEnd + 1);
    }
    // Use jsonrepair library to fix any remaining issues
    return jsonrepair(cleaned);
}
/**
 * Trip Builder Service
 */
export class TripBuilderService {
    env;
    db;
    logger;
    templateEngine;
    aiProvider;
    amadeusClient = null;
    viatorClient = null;
    firecrawlClient = null;
    currentTripId = null; // For telemetry context
    currentModelId; // Model ID for current request
    constructor(env, db, logger) {
        this.env = env;
        this.db = db;
        this.logger = logger;
        this.templateEngine = createTemplateEngine();
        this.aiProvider = createAIProviderManager(env, logger);
        // Create clients with graceful fallback if API keys not configured
        try {
            this.amadeusClient = createAmadeusClient(env, logger);
        }
        catch (error) {
            this.logger.warn(`Amadeus client not available: ${error}`);
        }
        try {
            this.viatorClient = createViatorClient(env, logger, db.getD1Database());
        }
        catch (error) {
            this.logger.warn(`Viator client not available: ${error}`);
        }
        // Create Firecrawl client for URL enrichment
        this.firecrawlClient = createFirecrawlClient(env, logger);
        if (this.firecrawlClient) {
            this.logger.info('Firecrawl client available for URL enrichment');
        }
    }
    /**
     * Build trip options
     */
    async buildTripOptions(request) {
        const { tripId, template, confirmedDestinations, preferences } = request;
        this.currentTripId = tripId; // Set for telemetry context
        // Set model ID from preferences for this request
        this.currentModelId = preferences?.ai_model || undefined;
        if (this.currentModelId) {
            this.logger.info(`Using selected AI model: ${this.currentModelId}`);
        }
        this.logger.info(`=== PHASE 2 START: Building trip options for ${tripId} ===`);
        this.logger.info(`Amadeus available: ${!!this.amadeusClient}, Viator available: ${!!this.viatorClient}`);
        const costTracker = createCostTracker(this.db, this.logger, tripId);
        // Log that Phase 2 started
        await this.logger.logTelemetry(this.db, tripId, 'phase2_start', {
            details: {
                destinations: confirmedDestinations,
                amadeusAvailable: !!this.amadeusClient,
                viatorAvailable: !!this.viatorClient,
            }
        });
        await this.logger.logUserProgress(this.db, tripId, 'Searching for flights...', 20);
        try {
            // Step 1: Search flights
            const flights = await this.searchFlights(confirmedDestinations, preferences, costTracker);
            await this.logger.logUserProgress(this.db, tripId, 'Finding hotels...', 40);
            // Step 2: Search hotels
            const hotels = await this.searchHotels(confirmedDestinations, preferences, costTracker);
            await this.logger.logUserProgress(this.db, tripId, 'Discovering tours and activities...', 60);
            // Step 3: Search tours
            const tours = await this.searchTours(confirmedDestinations, preferences, costTracker);
            await this.logger.logUserProgress(this.db, tripId, 'Creating trip options...', 75);
            // Step 4: Generate trip options using AI
            const options = await this.generateTripOptions(template, confirmedDestinations, preferences, flights, hotels, tours, costTracker, tripId);
            await this.logger.logUserProgress(this.db, tripId, 'Finding booking URLs...', 90);
            // Step 5: Enrich options with real booking URLs using Firecrawl
            const enrichedOptions = await this.enrichBookingUrls(options, costTracker, tripId);
            await this.logger.logUserProgress(this.db, tripId, 'Trip options ready!', 100);
            // Step 6: Store options in database
            await this.db.updateTripOptions(tripId, enrichedOptions);
            return { options: enrichedOptions };
        }
        catch (error) {
            this.logger.error(`Trip building failed for trip ${tripId}: ${error}`);
            await this.db.updateTripStatus(tripId, 'awaiting_confirmation', 'Trip building failed. Please try again.', 0);
            throw error;
        }
    }
    /**
     * Search flights
     */
    async searchFlights(destinations, preferences, costTracker) {
        const startTime = Date.now();
        if (!this.amadeusClient) {
            this.logger.warn('Amadeus client not available, skipping flight search');
            if (this.currentTripId) {
                await this.logger.logTelemetry(this.db, this.currentTripId, 'flight_search', {
                    provider: 'Amadeus',
                    details: { skipped: true, reason: 'Client not available' },
                });
            }
            return [];
        }
        if (!preferences.departure_airport) {
            this.logger.warn('No departure airport specified, skipping flight search');
            if (this.currentTripId) {
                await this.logger.logTelemetry(this.db, this.currentTripId, 'flight_search', {
                    provider: 'Amadeus',
                    details: { skipped: true, reason: 'No departure airport' },
                });
            }
            return [];
        }
        // Search for round-trip flights to primary destination
        const primaryDestination = destinations[0];
        const destinationAirport = await this.amadeusClient.getAirportCode(primaryDestination);
        // Log location lookup
        if (this.currentTripId) {
            await this.logger.logTelemetry(this.db, this.currentTripId, 'amadeus_location_lookup', {
                provider: 'Amadeus',
                details: { destination: primaryDestination, resolved_code: destinationAirport },
            });
        }
        // Calculate dates (for demo, use 30 days from now)
        const departureDate = preferences.departure_date || this.getDefaultDepartureDate();
        const returnDate = this.getReturnDate(departureDate, preferences.duration || '7 days');
        try {
            const flightOffers = await this.amadeusClient.searchFlights({
                originLocationCode: preferences.departure_airport,
                destinationLocationCode: destinationAirport,
                departureDate,
                returnDate,
                adults: preferences.travelers_adults || 2,
                travelClass: this.getTravelClass(preferences.luxury_level),
                max: 5,
            }, costTracker);
            const elapsed = Date.now() - startTime;
            // Log detailed telemetry
            if (this.currentTripId) {
                await this.logger.logTelemetry(this.db, this.currentTripId, 'flight_search', {
                    provider: 'Amadeus',
                    duration_ms: elapsed,
                    details: {
                        origin: preferences.departure_airport,
                        destination: destinationAirport,
                        departure_date: departureDate,
                        return_date: returnDate,
                        results_count: flightOffers.length,
                        cheapest_price: flightOffers[0]?.price?.total || 'N/A',
                    },
                });
            }
            return flightOffers;
        }
        catch (error) {
            const elapsed = Date.now() - startTime;
            this.logger.warn(`Flight search failed: ${error}`);
            if (this.currentTripId) {
                await this.logger.logTelemetry(this.db, this.currentTripId, 'flight_search', {
                    provider: 'Amadeus',
                    duration_ms: elapsed,
                    details: { error: String(error), origin: preferences.departure_airport, destination: destinationAirport },
                });
            }
            return [];
        }
    }
    /**
     * Search hotels
     */
    async searchHotels(destinations, preferences, costTracker) {
        const startTime = Date.now();
        if (!this.amadeusClient) {
            this.logger.warn('Amadeus client not available, skipping hotel search');
            if (this.currentTripId) {
                await this.logger.logTelemetry(this.db, this.currentTripId, 'hotel_search', {
                    provider: 'Amadeus',
                    details: { skipped: true, reason: 'Client not available' },
                });
            }
            return [];
        }
        const allHotels = [];
        const searchDetails = [];
        const departureDate = preferences.departure_date || this.getDefaultDepartureDate();
        const duration = this.parseDuration(preferences.duration || '7 days');
        const daysPerDestination = Math.floor(duration / destinations.length);
        let currentDate = new Date(departureDate);
        for (const destination of destinations) {
            const destStartTime = Date.now();
            const cityCode = await this.amadeusClient.getCityCode(destination);
            // Log location lookup
            if (this.currentTripId) {
                await this.logger.logTelemetry(this.db, this.currentTripId, 'amadeus_location_lookup', {
                    provider: 'Amadeus',
                    details: { destination, resolved_code: cityCode, type: 'city' },
                });
            }
            const checkInDate = this.formatDate(currentDate);
            const checkOutDate = this.formatDate(new Date(currentDate.getTime() + daysPerDestination * 24 * 60 * 60 * 1000));
            try {
                const hotels = await this.amadeusClient.searchHotels({
                    cityCode,
                    checkInDate,
                    checkOutDate,
                    adults: preferences.travelers_adults || 2,
                    ratings: this.getHotelRatings(preferences.luxury_level),
                }, costTracker);
                const destElapsed = Date.now() - destStartTime;
                searchDetails.push({
                    destination,
                    city_code: cityCode,
                    check_in: checkInDate,
                    check_out: checkOutDate,
                    results_count: hotels.length,
                    selected_count: Math.min(hotels.length, 3),
                    duration_ms: destElapsed,
                });
                allHotels.push(...hotels.slice(0, 3)); // Top 3 per destination
            }
            catch (error) {
                this.logger.warn(`Hotel search failed for ${destination}: ${error}`);
                searchDetails.push({
                    destination,
                    city_code: cityCode,
                    error: String(error),
                    duration_ms: Date.now() - destStartTime,
                });
            }
            // Move to next destination
            currentDate = new Date(currentDate.getTime() + daysPerDestination * 24 * 60 * 60 * 1000);
        }
        const elapsed = Date.now() - startTime;
        // Log summary telemetry
        if (this.currentTripId) {
            await this.logger.logTelemetry(this.db, this.currentTripId, 'hotel_search', {
                provider: 'Amadeus',
                duration_ms: elapsed,
                details: {
                    destinations_searched: destinations.length,
                    total_results: allHotels.length,
                    searches: searchDetails,
                },
            });
        }
        return allHotels;
    }
    /**
     * Search tours
     */
    async searchTours(destinations, preferences, costTracker) {
        const startTime = Date.now();
        if (!this.viatorClient) {
            this.logger.warn('Viator client not available, skipping tour search');
            if (this.currentTripId) {
                await this.logger.logTelemetry(this.db, this.currentTripId, 'tour_search', {
                    provider: 'Viator',
                    details: { skipped: true, reason: 'Client not available' },
                });
            }
            return [];
        }
        const allTours = [];
        const searchDetails = [];
        for (const destination of destinations) {
            const destStartTime = Date.now();
            const destinationId = await this.viatorClient.getDestinationId(destination);
            try {
                const tours = await this.viatorClient.searchTours({
                    destination: destinationId,
                    tags: this.viatorClient.getHeritageTags(),
                    count: 5,
                }, costTracker);
                const destElapsed = Date.now() - destStartTime;
                searchDetails.push({
                    destination,
                    destination_id: destinationId,
                    results_count: tours.length,
                    selected_count: Math.min(tours.length, 3),
                    duration_ms: destElapsed,
                });
                allTours.push(...tours.slice(0, 3)); // Top 3 per destination
            }
            catch (error) {
                this.logger.warn(`Tour search failed for ${destination}: ${error}`);
                searchDetails.push({
                    destination,
                    destination_id: destinationId,
                    error: String(error),
                    duration_ms: Date.now() - destStartTime,
                });
            }
        }
        const elapsed = Date.now() - startTime;
        // Log summary telemetry
        if (this.currentTripId) {
            await this.logger.logTelemetry(this.db, this.currentTripId, 'tour_search', {
                provider: 'Viator',
                duration_ms: elapsed,
                details: {
                    destinations_searched: destinations.length,
                    total_results: allTours.length,
                    searches: searchDetails,
                },
            });
        }
        return allTours;
    }
    /**
     * Enrich trip options with real booking URLs using Firecrawl search
     * Replaces placeholder Google Search URLs with actual booking site URLs
     */
    async enrichBookingUrls(options, costTracker, tripId) {
        if (!this.firecrawlClient) {
            this.logger.info('Firecrawl not available, skipping URL enrichment');
            await this.logger.logTelemetry(this.db, tripId, 'url_enrichment', {
                details: { skipped: true, reason: 'Firecrawl client not available' },
            });
            return options;
        }
        const startTime = Date.now();
        const telemetryCtx = { db: this.db, tripId };
        this.logger.info(`Enriching booking URLs for ${options.length} trip options...`);
        // Track what we've already searched to avoid duplicates
        const hotelUrlCache = new Map();
        const tourUrlCache = new Map();
        const enrichedOptions = [];
        let hotelsEnriched = 0;
        let toursEnriched = 0;
        let totalSearches = 0;
        for (const option of options) {
            const enrichedHotels = [];
            const enrichedTours = [];
            // Enrich hotel URLs
            for (const hotel of (option.hotels || [])) {
                const cacheKey = `${hotel.name}|${hotel.city}`;
                // Check cache first
                if (hotelUrlCache.has(cacheKey)) {
                    enrichedHotels.push({ ...hotel, info_url: hotelUrlCache.get(cacheKey) });
                    continue;
                }
                // Skip if already has a good URL (not a Google search)
                if (hotel.info_url && !hotel.info_url.includes('google.com/search')) {
                    enrichedHotels.push(hotel);
                    hotelUrlCache.set(cacheKey, hotel.info_url);
                    continue;
                }
                // Search for real booking URL
                const url = await this.firecrawlClient.findBookingUrl(hotel.name, hotel.city, 'hotel', costTracker, telemetryCtx);
                totalSearches++;
                if (url) {
                    enrichedHotels.push({ ...hotel, info_url: url });
                    hotelUrlCache.set(cacheKey, url);
                    hotelsEnriched++;
                    this.logger.debug(`Found hotel URL for ${hotel.name}: ${url}`);
                }
                else {
                    enrichedHotels.push(hotel);
                    this.logger.debug(`No URL found for hotel ${hotel.name}`);
                }
            }
            // Enrich tour URLs
            for (const tour of (option.tours || [])) {
                const cacheKey = `${tour.name}|${tour.city}`;
                // Check cache first
                if (tourUrlCache.has(cacheKey)) {
                    enrichedTours.push({ ...tour, info_url: tourUrlCache.get(cacheKey) });
                    continue;
                }
                // Skip if already has a good URL (not a Google search)
                if (tour.info_url && !tour.info_url.includes('google.com/search')) {
                    enrichedTours.push(tour);
                    tourUrlCache.set(cacheKey, tour.info_url);
                    continue;
                }
                // Search for real booking URL
                const url = await this.firecrawlClient.findBookingUrl(tour.name, tour.city, 'tour', costTracker, telemetryCtx);
                totalSearches++;
                if (url) {
                    enrichedTours.push({ ...tour, info_url: url });
                    tourUrlCache.set(cacheKey, url);
                    toursEnriched++;
                    this.logger.debug(`Found tour URL for ${tour.name}: ${url}`);
                }
                else {
                    enrichedTours.push(tour);
                    this.logger.debug(`No URL found for tour ${tour.name}`);
                }
            }
            enrichedOptions.push({
                ...option,
                hotels: enrichedHotels,
                tours: enrichedTours,
            });
        }
        const elapsed = Date.now() - startTime;
        // Log summary telemetry
        await this.logger.logTelemetry(this.db, tripId, 'url_enrichment', {
            provider: 'Firecrawl',
            duration_ms: elapsed,
            details: {
                options_processed: options.length,
                total_searches: totalSearches,
                hotels_enriched: hotelsEnriched,
                tours_enriched: toursEnriched,
                cache_hits: (hotelUrlCache.size - hotelsEnriched) + (tourUrlCache.size - toursEnriched),
            },
        });
        this.logger.info(`URL enrichment complete: ${hotelsEnriched} hotels, ${toursEnriched} tours enriched in ${elapsed}ms`);
        return enrichedOptions;
    }
    /**
     * Generate trip options using AI
     */
    async generateTripOptions(template, destinations, preferences, flights, hotels, tours, costTracker, tripId) {
        const context = {
            destinations: destinations.join(', '),
            departure_airport: preferences.departure_airport,
            luxury_level: preferences.luxury_level,
            number_of_options: template.number_of_options,
            duration: preferences.duration,
        };
        const optionsPrompt = this.templateEngine.buildOptionsPrompt(template, context);
        // Build booking data context
        const bookingContext = this.buildBookingContext(flights, hotels, tours);
        // Calculate trip duration in days
        const tripDays = this.parseDuration(preferences.duration || '7 days');
        const departureAirport = preferences.departure_airport || 'JFK';
        // Calculate actual trip dates
        const departureDate = preferences.departure_date || this.getDefaultDepartureDate();
        const returnDate = this.getReturnDate(departureDate, preferences.duration || '7 days');
        const prompt = `${optionsPrompt}

CONFIRMED DESTINATIONS (You MUST use these exact locations):
${destinations.map((d, i) => `${i + 1}. ${d}`).join('\n')}

TRIP DATES: ${departureDate} to ${returnDate} (${tripDays} days)
DEPARTURE AIRPORT: ${departureAirport} (ALL flights MUST depart from and return to this airport)

Available booking options:

FLIGHTS:
${bookingContext.flights}

HOTELS:
${bookingContext.hotels}

TOURS:
${bookingContext.tours}

CRITICAL REQUIREMENTS:
1. Generate exactly ${template.number_of_options} trip options as a JSON array
2. ALL hotels and tours MUST be in the CONFIRMED DESTINATIONS listed above
3. Do NOT use any other destinations - ONLY ${destinations.join(', ')}
4. If booking data is unavailable, create realistic placeholder names for hotels/tours in those specific destinations
5. Each option must include flights, hotels, tours, and total cost
6. Include info_url for hotels (use format: https://www.google.com/search?q=HOTEL+NAME+CITY+hotel)
7. Include info_url for tours (use format: https://www.google.com/search?q=TOUR+NAME+CITY)
8. CRITICAL: ALL flight routes MUST use ${departureAirport} as the departure and return airport - do NOT use any other airports
9. CRITICAL: Output MUST be valid JSON with proper commas between all array elements and object properties
10. CRITICAL: Use the exact trip dates provided (${departureDate} departure, ${returnDate} return)
11. CRITICAL: Include cost_usd for both outbound and return flights (estimate $400-800 per segment for transatlantic)

Format:
[
  {
    "option_index": 1,
    "total_cost_usd": 3500.00,
    "flights": {
      "outbound": { "airline": "British Airways", "route": "${departureAirport} → EDI", "departure": "${departureDate}T10:00", "arrival": "${departureDate}T22:00", "cost_usd": 650.00 },
      "return": { "airline": "British Airways", "route": "EDI → ${departureAirport}", "departure": "${returnDate}T12:00", "arrival": "${returnDate}T15:00", "cost_usd": 650.00 }
    },
    "hotels": [
      { "city": "${destinations[0] || 'Destination 1'}", "name": "Hotel Name", "rating": 4, "nights": 4, "cost_per_night_usd": 180.00, "info_url": "https://www.google.com/search?q=Hotel+Name+City+hotel" }
    ],
    "tours": [
      { "city": "${destinations[0] || 'Destination 1'}", "name": "Heritage Tour", "duration": "3 hours", "cost_usd": 45.00, "info_url": "https://www.google.com/search?q=Heritage+Tour+City" }
    ],
    "itinerary_highlights": "Brief 2-3 sentence description of the trip experience in ${destinations.join(', ')}"
  }
]`;
        const aiResponse = await this.aiProvider.generate({
            prompt,
            systemPrompt: 'You are a travel planning assistant. Respond ONLY with valid JSON arrays. Create realistic trip packages with accurate pricing.',
            maxTokens: 2500,
            temperature: 0.7,
        }, {
            modelId: this.currentModelId,
            tripId,
            taskType: 'trip_options_generation',
            costTracker,
        });
        await this.logger.logTelemetry(this.db, tripId, 'trip_options_generation', {
            provider: aiResponse.provider,
            model: aiResponse.model,
            tokens: aiResponse.totalTokens,
            cost: aiResponse.cost,
            details: {
                destinations: destinations,
                flightsFound: flights.length,
                hotelsFound: hotels.length,
                toursFound: tours.length,
            }
        });
        // Parse JSON response
        try {
            const jsonMatch = aiResponse.text.match(/\[[\s\S]*\]/);
            if (!jsonMatch)
                throw new Error('No JSON array found in response');
            // Use jsonrepair library to fix AI JSON errors
            const repairedJSON = extractAndRepairJSON(jsonMatch[0]);
            let options;
            try {
                options = JSON.parse(repairedJSON);
            }
            catch (parseError) {
                // Log both original and repaired for debugging
                this.logger.warn(`JSON repair failed, original: ${jsonMatch[0].slice(0, 500)}...`);
                this.logger.warn(`Repaired attempt: ${repairedJSON.slice(0, 500)}...`);
                throw parseError;
            }
            if (!Array.isArray(options) || options.length === 0) {
                throw new Error('AI returned invalid trip options');
            }
            this.logger.info(`Generated ${options.length} trip options`);
            return options;
        }
        catch (error) {
            this.logger.error(`Failed to parse AI trip options: ${error}`);
            throw new Error('Failed to generate trip options');
        }
    }
    /**
     * Generate daily itinerary for a specific trip option (on-demand)
     */
    async generateDailyItinerary(tripId, option, destinations, tripDays) {
        const startTime = Date.now();
        const costTracker = createCostTracker(this.db, this.logger, tripId);
        // Safely handle potentially undefined arrays
        const hotels = option.hotels || [];
        const tours = option.tours || [];
        // Extract trip start date from flights, or use default (6 months from now)
        let tripStartDate = this.getDefaultDepartureDate();
        if (option.flights?.outbound?.departure) {
            // Extract date from ISO datetime string (e.g., "2025-06-01T10:00")
            tripStartDate = option.flights.outbound.departure.split('T')[0];
        }
        // Generate all trip dates
        const tripDates = this.generateTripDates(tripStartDate, tripDays);
        // Log telemetry for the request
        await this.logger.logTelemetry(this.db, tripId, 'itinerary_generation_start', {
            details: {
                option_index: option.option_index,
                destinations,
                trip_days: tripDays,
                trip_start_date: tripStartDate,
                hotels_count: hotels.length,
                tours_count: tours.length,
            },
        });
        const prompt = `Create a day-by-day itinerary for a ${tripDays}-day trip to ${destinations.join(', ')}.

TRIP DATES: ${tripStartDate} to ${tripDates[tripDates.length - 1]} (${tripDays} days)
Daily dates: ${tripDates.map((d, i) => `Day ${i + 1}: ${d}`).join(', ')}

TRIP DETAILS:
- Hotels: ${hotels.length > 0 ? hotels.map(h => `${h.name} in ${h.city} (${h.nights} nights)`).join(', ') : 'None specified'}
- Tours booked: ${tours.length > 0 ? tours.map(t => `${t.name} in ${t.city}`).join(', ') : 'None specified'}

Create a daily_itinerary array with one entry per day. Each day should have 3-4 activities mixing:
- free: Free attractions, parks, viewpoints
- walking_tour: Self-guided neighborhood walks
- photo_op: Scenic photo spots
- dining: Restaurant recommendations
- tour: The booked tours (integrate them appropriately)

CRITICAL: Include the "date" field for each day using the exact dates provided above.

Format as JSON array:
[
  {
    "day_number": 1,
    "date": "${tripDates[0]}",
    "city": "CityName",
    "theme": "Arrival Day",
    "activities": [
      { "time": "2:00 PM", "activity": "Check in to hotel", "type": "free", "location": "Hotel Name" },
      { "time": "4:00 PM", "activity": "Walk the historic district", "type": "walking_tour", "duration": "1.5 hours" },
      { "time": "7:00 PM", "activity": "Dinner at local pub", "type": "dining", "location": "Pub Name", "cost_usd": 30 }
    ]
  }
]`;
        const aiResponse = await this.aiProvider.generate({
            prompt,
            systemPrompt: 'You are a travel planning assistant. Respond ONLY with a valid JSON array of daily itinerary objects.',
            maxTokens: 3000,
            temperature: 0.7,
        }, {
            modelId: this.currentModelId,
            tripId,
            taskType: 'daily_itinerary_generation',
            costTracker,
        });
        const elapsed = Date.now() - startTime;
        try {
            const jsonMatch = aiResponse.text.match(/\[[\s\S]*\]/);
            if (!jsonMatch)
                throw new Error('No JSON array found in AI response');
            const dailyItinerary = JSON.parse(jsonMatch[0]);
            // Log successful generation
            await this.logger.logTelemetry(this.db, tripId, 'daily_itinerary_generation', {
                provider: aiResponse.provider,
                model: aiResponse.model,
                tokens: aiResponse.totalTokens,
                cost: aiResponse.cost,
                duration_ms: elapsed,
                details: {
                    option_index: option.option_index,
                    days_generated: dailyItinerary.length,
                    success: true,
                },
            });
            return { ...option, daily_itinerary: dailyItinerary };
        }
        catch (error) {
            this.logger.error(`Failed to parse daily itinerary: ${error}`);
            // Log failed generation
            await this.logger.logTelemetry(this.db, tripId, 'daily_itinerary_generation', {
                provider: aiResponse.provider,
                model: aiResponse.model,
                tokens: aiResponse.totalTokens,
                cost: aiResponse.cost,
                duration_ms: elapsed,
                details: {
                    option_index: option.option_index,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    raw_response_preview: aiResponse.text.substring(0, 200),
                },
            });
            throw error; // Re-throw so the API returns an error
        }
    }
    /**
     * Build booking context for AI prompt
     */
    buildBookingContext(flights, hotels, tours) {
        let flightsContext = '';
        flights.slice(0, 5).forEach((flight, index) => {
            const outbound = flight.itineraries[0];
            const returnFlight = flight.itineraries[1];
            flightsContext += `${index + 1}. ${flight.validatingAirlineCodes[0]} - $${flight.price.total} (${outbound.segments.length > 1 ? 'with stops' : 'direct'})\n`;
        });
        let hotelsContext = '';
        hotels.slice(0, 10).forEach((hotel, index) => {
            const offer = hotel.offers[0];
            const nights = this.calculateNights(offer.checkInDate, offer.checkOutDate);
            hotelsContext += `${index + 1}. ${hotel.hotel.name} (${hotel.hotel.rating || '?'}-star) in ${hotel.hotel.cityCode} - $${offer.price.total} for ${nights} nights\n`;
        });
        let toursContext = '';
        tours.slice(0, 10).forEach((tour, index) => {
            const duration = this.viatorClient?.formatDuration(tour.duration.fixedDurationInMinutes) || 'Duration varies';
            toursContext += `${index + 1}. ${tour.title} - ${duration} - $${tour.pricing.summary.fromPrice}\n`;
        });
        return {
            flights: flightsContext || 'No flights available',
            hotels: hotelsContext || 'No hotels available',
            tours: toursContext || 'No tours available',
        };
    }
    /**
     * Helper: Get travel class from luxury level
     */
    getTravelClass(luxuryLevel) {
        switch (luxuryLevel) {
            case 'Luxury':
                return 'BUSINESS';
            case 'Comfort':
                return 'PREMIUM_ECONOMY';
            default:
                return 'ECONOMY';
        }
    }
    /**
     * Helper: Get hotel ratings from luxury level
     */
    getHotelRatings(luxuryLevel) {
        switch (luxuryLevel) {
            case 'Luxury':
                return ['4', '5'];
            case 'Comfort':
                return ['3', '4'];
            default:
                return ['2', '3'];
        }
    }
    /**
     * Helper: Get default departure date (6 months from now)
     */
    getDefaultDepartureDate() {
        const date = new Date();
        date.setMonth(date.getMonth() + 6);
        return this.formatDate(date);
    }
    /**
     * Helper: Get return date from departure and duration
     */
    getReturnDate(departureDate, duration) {
        const days = this.parseDuration(duration);
        const date = new Date(departureDate);
        date.setDate(date.getDate() + days);
        return this.formatDate(date);
    }
    /**
     * Helper: Parse duration string to days
     */
    parseDuration(duration) {
        const match = duration.match(/(\d+)/);
        return match ? parseInt(match[1]) : 7;
    }
    /**
     * Helper: Format date as YYYY-MM-DD
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }
    /**
     * Helper: Calculate nights between dates
     */
    calculateNights(checkIn, checkOut) {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    /**
     * Helper: Generate array of trip dates from start date
     */
    generateTripDates(startDate, tripDays) {
        const dates = [];
        const start = new Date(startDate);
        for (let i = 0; i < tripDays; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            dates.push(this.formatDate(date));
        }
        return dates;
    }
}
/**
 * Create trip builder service
 */
export function createTripBuilderService(env, db, logger) {
    return new TripBuilderService(env, db, logger);
}
