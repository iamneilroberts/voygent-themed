/**
 * POST /api/trips/:id/handoff
 * Generate travel agent handoff document
 * Marks trip as ready for agent review
 */
import { createDatabaseClient } from '../../../lib/db';
import { createLogger } from '../../../lib/logger';
export async function onRequestPost(context) {
    const logger = createLogger();
    const db = createDatabaseClient(context.env);
    const tripId = context.params.id;
    try {
        // Parse request body
        const body = await context.request.json();
        logger.info(`Generating handoff document for trip ${tripId}`);
        // Get trip
        const trip = await db.getTrip(tripId);
        if (!trip) {
            return new Response(JSON.stringify({ error: 'Trip not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // Verify trip has selected option
        if (!trip.selected_option_index || !trip.options_json) {
            return new Response(JSON.stringify({
                error: 'No trip option selected. Please select a trip option first.',
                code: 'NO_OPTION_SELECTED',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // Get template
        const template = await db.getTemplate(trip.template_id);
        if (!template) {
            return new Response(JSON.stringify({ error: 'Template not found' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // Parse trip data
        const options = JSON.parse(trip.options_json);
        const selectedOption = options.find(opt => opt.option_index === trip.selected_option_index);
        const destinations = trip.confirmed_destinations
            ? JSON.parse(trip.confirmed_destinations).map((name) => ({ name }))
            : [];
        // Generate handoff document
        const handoffDocument = generateHandoffDocument(trip.id, template.name, destinations, selectedOption, body.user_contact, body.special_requests);
        // Update trip status
        await db.updateTripStatus(tripId, 'handoff_sent', 'Your trip request has been sent to a travel professional', 100);
        logger.info(`Handoff document generated for trip ${tripId}`);
        return new Response(JSON.stringify({
            handoff_id: tripId,
            message: 'Your trip request has been sent to a travel professional. You will receive a response within 24 hours.',
            estimated_response_time: '24 hours',
            handoff_document: handoffDocument,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
    catch (error) {
        logger.error(`Failed to generate handoff for trip ${tripId}: ${error}`);
        return new Response(JSON.stringify({ error: 'Failed to generate handoff document' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
/**
 * Generate handoff document for travel agent
 */
function generateHandoffDocument(tripId, tripType, destinations, selectedOption, userContact, specialRequests) {
    return {
        trip_id: tripId,
        created_at: new Date().toISOString(),
        // Trip Overview
        trip_type: tripType,
        destinations: destinations.map(d => d.name || d),
        total_cost_usd: selectedOption.total_cost_usd,
        // Flights
        flights: {
            outbound: {
                airline: selectedOption.flights.outbound.airline,
                route: selectedOption.flights.outbound.route,
                departure: selectedOption.flights.outbound.departure,
                arrival: selectedOption.flights.outbound.arrival,
            },
            return: {
                airline: selectedOption.flights.return.airline,
                route: selectedOption.flights.return.route,
                departure: selectedOption.flights.return.departure,
                arrival: selectedOption.flights.return.arrival,
            },
        },
        // Hotels
        hotels: selectedOption.hotels.map(hotel => ({
            city: hotel.city,
            name: hotel.name,
            rating: hotel.rating,
            nights: hotel.nights,
            cost_per_night_usd: hotel.cost_per_night_usd,
            total_cost_usd: hotel.nights * hotel.cost_per_night_usd,
        })),
        // Tours & Activities
        tours: selectedOption.tours.map(tour => ({
            city: tour.city,
            name: tour.name,
            duration: tour.duration,
            cost_usd: tour.cost_usd,
        })),
        // Itinerary Highlights
        itinerary_highlights: selectedOption.itinerary_highlights,
        // User Contact
        user_contact: userContact || {
            name: 'Not provided',
            email: 'Not provided',
            phone: 'Not provided',
        },
        // Special Requests
        special_requests: specialRequests || 'None',
        // Agent Notes
        agent_notes: {
            message: 'This is an auto-generated trip request from VoyGent. Please review and contact the customer with a detailed proposal.',
            priority: 'Normal',
            next_steps: [
                'Review flight options and confirm availability',
                'Confirm hotel reservations',
                'Book tours and activities',
                'Prepare detailed itinerary with maps and directions',
                'Contact customer with finalized proposal and pricing',
            ],
        },
    };
}
// CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
