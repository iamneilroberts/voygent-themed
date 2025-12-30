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
            this.viatorClient = createViatorClient(env, logger);
        }
        catch (error) {
            this.logger.warn(`Viator client not available: ${error}`);
        }
    }
    /**
     * Build trip options
     */
    async buildTripOptions(request) {
        const { tripId, template, confirmedDestinations, preferences } = request;
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
            await this.logger.logUserProgress(this.db, tripId, 'Creating trip options...', 80);
            // Step 4: Generate trip options using AI
            const options = await this.generateTripOptions(template, confirmedDestinations, preferences, flights, hotels, tours, costTracker, tripId);
            await this.logger.logUserProgress(this.db, tripId, 'Trip options ready!', 100);
            // Step 5: Store options in database
            await this.db.updateTripOptions(tripId, options);
            return { options };
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
        if (!this.amadeusClient) {
            this.logger.warn('Amadeus client not available, skipping flight search');
            return [];
        }
        if (!preferences.departure_airport) {
            this.logger.warn('No departure airport specified, skipping flight search');
            return [];
        }
        // Search for round-trip flights to primary destination
        const primaryDestination = destinations[0];
        const destinationAirport = await this.amadeusClient.getAirportCode(primaryDestination);
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
            return flightOffers;
        }
        catch (error) {
            this.logger.warn(`Flight search failed: ${error}`);
            return [];
        }
    }
    /**
     * Search hotels
     */
    async searchHotels(destinations, preferences, costTracker) {
        if (!this.amadeusClient) {
            this.logger.warn('Amadeus client not available, skipping hotel search');
            return [];
        }
        const allHotels = [];
        const departureDate = preferences.departure_date || this.getDefaultDepartureDate();
        const duration = this.parseDuration(preferences.duration || '7 days');
        const daysPerDestination = Math.floor(duration / destinations.length);
        let currentDate = new Date(departureDate);
        for (const destination of destinations) {
            const cityCode = await this.amadeusClient.getCityCode(destination);
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
                allHotels.push(...hotels.slice(0, 3)); // Top 3 per destination
            }
            catch (error) {
                this.logger.warn(`Hotel search failed for ${destination}: ${error}`);
            }
            // Move to next destination
            currentDate = new Date(currentDate.getTime() + daysPerDestination * 24 * 60 * 60 * 1000);
        }
        return allHotels;
    }
    /**
     * Search tours
     */
    async searchTours(destinations, preferences, costTracker) {
        if (!this.viatorClient) {
            this.logger.warn('Viator client not available, skipping tour search');
            return [];
        }
        const allTours = [];
        for (const destination of destinations) {
            const destinationId = this.viatorClient.getDestinationId(destination);
            try {
                const tours = await this.viatorClient.searchTours({
                    destination: destinationId,
                    tags: this.viatorClient.getHeritageTags(),
                    count: 5,
                }, costTracker);
                allTours.push(...tours.slice(0, 3)); // Top 3 per destination
            }
            catch (error) {
                this.logger.warn(`Tour search failed for ${destination}: ${error}`);
            }
        }
        return allTours;
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
        const prompt = `${optionsPrompt}

CONFIRMED DESTINATIONS (You MUST use these exact locations):
${destinations.map((d, i) => `${i + 1}. ${d}`).join('\n')}

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

Format:
[
  {
    "option_index": 1,
    "total_cost_usd": 3500.00,
    "flights": {
      "outbound": { "airline": "British Airways", "route": "JFK → EDI", "departure": "2025-06-01T10:00", "arrival": "2025-06-01T22:00" },
      "return": { "airline": "British Airways", "route": "EDI → JFK", "departure": "2025-06-08T12:00", "arrival": "2025-06-08T15:00" }
    },
    "hotels": [
      { "city": "${destinations[0] || 'Destination 1'}", "name": "Hotel Name", "rating": 4, "nights": 4, "cost_per_night_usd": 180.00 }
    ],
    "tours": [
      { "city": "${destinations[0] || 'Destination 1'}", "name": "Heritage Tour", "duration": "3 hours", "cost_usd": 45.00 }
    ],
    "itinerary_highlights": "Brief description of activities in ${destinations.join(', ')}"
  }
]`;
        const aiResponse = await this.aiProvider.generate({
            prompt,
            systemPrompt: 'You are a travel planning assistant. Respond ONLY with valid JSON arrays.',
            maxTokens: 3000,
            temperature: 0.7,
        }, costTracker);
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
            const options = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(options) || options.length === 0) {
                throw new Error('AI returned invalid trip options');
            }
            this.logger.info(`Generated ${options.length} trip options`);
            return options;
        }
        catch (error) {
            this.logger.error(`Failed to parse AI trip options: ${error}\nResponse: ${aiResponse.text}`);
            throw new Error('Failed to generate trip options');
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
     * Helper: Get default departure date (30 days from now)
     */
    getDefaultDepartureDate() {
        const date = new Date();
        date.setDate(date.getDate() + 30);
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
}
/**
 * Create trip builder service
 */
export function createTripBuilderService(env, db, logger) {
    return new TripBuilderService(env, db, logger);
}
